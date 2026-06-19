'use client';

import { useEffect, useState } from 'react';
import {
  connectWallet,
  getAcademicContract,
  issueCredentialTx,
  revokeCredentialTx,
  getCredentialStats,
  ROLES,
  resolveRole,
  toBytes32FromDecimal,
} from '../../utils/web3';
import { createCredentialPayload, buildTranscriptInputs, encryptCredential, payloadToStorageBundle } from '../../utils/crypto';
import { setCidForToken } from '../../utils/credentialIndex';

function randomSalt() {
  const bytes = window.crypto.getRandomValues(new Uint32Array(2));
  const random = (BigInt(bytes[0]) << 32n) + BigInt(bytes[1]);
  return random.toString();
}

async function computePoseidonHash({ transcriptData, secretSalt }) {
  const response = await fetch('/api/hasher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcriptData, secretSalt }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Poseidon hashing failed');
  }
  return data.hash;
}

async function pinEncryptedBundle(bundle) {
  const response = await fetch('/api/ipfs/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedPayload: JSON.stringify(bundle),
      metadata: { name: `ppacvs-credential-${Date.now()}` },
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || 'IPFS upload failed');
  }
  return data.cid;
}

export default function IssuerPortal() {
  const [tab, setTab] = useState('dashboard');
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [connected, setConnected] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [degree, setDegree] = useState('');
  const [gpa, setGpa] = useState('');
  const [salt, setSalt] = useState(randomSalt());
  const [secretKey, setSecretKey] = useState('');
  const [issueStatus, setIssueStatus] = useState('');

  const [tokenId, setTokenId] = useState('');
  const [revokeStatus, setRevokeStatus] = useState('');
  const [stats, setStats] = useState({ totalIssued: 0, activeCount: 0, pendingVerifications: 0 });

  const [loading, setLoading] = useState(false);
  const [roleMessage, setRoleMessage] = useState('');

  const connectAsIssuer = async () => {
    try {
      setLoading(true);
      const { provider, account } = await connectWallet();
      const contractInstance = await getAcademicContract(provider);
      const role = await resolveRole(account, contractInstance);
      if (role !== ROLES.ISSUER) {
        throw new Error('Connected wallet is not authorized as issuer.');
      }
      const signer = provider.getSigner ? await provider.getSigner() : null;
      setAccount(account);
      setContract(contractInstance.connect(signer || provider));
      setConnected(true);
      setRoleMessage('Issuer session established.');
      await refreshStats(contractInstance.connect(signer || provider));
    } catch (error) {
      setRoleMessage(error.message || 'Unable to connect as issuer.');
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async (c = contract) => {
    if (!c) return;
    const latest = await getCredentialStats(c);
    setStats(latest);
  };

  const handleIssue = async () => {
    try {
      setLoading(true);
      setIssueStatus('');
      if (!studentAddress || !degree || !studentName || !gpa || !secretKey) {
        throw new Error('Fill all required issuer fields (Name, Wallet, Degree, GPA, key).');
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(studentAddress)) {
        throw new Error('Invalid student wallet address.');
      }
      if (!connected || !contract) throw new Error('Connect as issuer first.');

      const { transcriptData, secretSalt } = buildTranscriptInputs({ gpa, salt });
      const commitment = await computePoseidonHash({
        transcriptData,
        secretSalt,
      });

      const merkleRoot = toBytes32FromDecimal(commitment);
      const credentialPayload = createCredentialPayload({
        studentAddress,
        studentName,
        degree,
        gpa,
      });
      const ciphertext = await encryptCredential(credentialPayload, secretKey);
      const bundle = payloadToStorageBundle({
        studentAddress,
        studentName,
        degree,
        gpa,
        ciphertext,
        transcriptData,
        salt: secretSalt,
        merkleRoot,
        createdAt: new Date().toISOString(),
      });
      const cid = await pinEncryptedBundle(bundle);

      const tx = await issueCredentialTx(contract, studentAddress, merkleRoot);
      setIssueStatus(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      let issuedTokenId = '';
      try {
        const parsed = receipt.logs
          .map((raw) => {
            try {
              const log = contract.interface.parseLog(raw);
              return log?.name === 'CredentialIssued' ? log : null;
            } catch {
              return null;
            }
          })
          .find(Boolean);
        if (parsed?.args?.tokenId !== undefined) {
          issuedTokenId = String(parsed.args.tokenId);
        }
      } catch {
        // no-op
      }

      if (issuedTokenId) {
        setCidForToken(issuedTokenId, cid);
      }
      await refreshStats();
      setIssueStatus(
        `✅ Issued token ${issuedTokenId || '(ID pending)'}, IPFS CID ${cid}. Send this decryption key to student: ${secretKey}`
      );
      setStudentName('');
      setStudentAddress('');
      setDegree('');
      setGpa('');
      setSalt(randomSalt());
      setSecretKey('');
    } catch (error) {
      setIssueStatus(error.message || 'Issue failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setLoading(true);
      setRevokeStatus('');
      if (!tokenId) throw new Error('Token ID is required.');
      if (!connected || !contract) throw new Error('Connect as issuer first.');
      const tx = await revokeCredentialTx(contract, Number(tokenId));
      setRevokeStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      await refreshStats();
      setRevokeStatus(`✅ Revoked token #${tokenId}`);
      setTokenId('');
    } catch (error) {
      setRevokeStatus(error.message || 'Revoke failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!contract) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        await refreshStats();
      } catch (error) {
        console.error('stats refresh failed', error);
      }
    };
    tick();
    const interval = setInterval(tick, 10000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [contract]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold">University Issuer Portal</h1>
        <p className="text-slate-300">
          Issue SoulBound credentials to students and manage revocations.
        </p>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p>{connected ? `Connected issuer: ${account}` : roleMessage || 'Wallet not connected'}</p>
            <button
              onClick={connectAsIssuer}
              disabled={loading}
              className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {connected ? 'Reconnect Issuer Wallet' : 'Connect Wallet'}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-400">{roleMessage}</p>
        </div>

        <div className="flex gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2">
          {['dashboard', 'issue', 'revoke'].map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                tab === id ? 'bg-white text-slate-900' : 'text-slate-200'
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Dashboard</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <p className="rounded-lg bg-slate-800 p-4">
                <span className="block text-sm text-slate-400">Total Issued</span>
                <span className="mt-1 block text-2xl font-bold">{stats.totalIssued}</span>
              </p>
              <p className="rounded-lg bg-slate-800 p-4">
                <span className="block text-sm text-slate-400">Active Tokens</span>
                <span className="mt-1 block text-2xl font-bold">{stats.activeCount}</span>
              </p>
              <p className="rounded-lg bg-slate-800 p-4">
                <span className="block text-sm text-slate-400">Pending Verifications</span>
                <span className="mt-1 block text-2xl font-bold">{stats.pendingVerifications}</span>
              </p>
            </div>
          </article>
        )}

        {tab === 'issue' && (
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Issue New Credential</h2>
            <p className="mt-1 text-sm text-slate-400">JSON-LD payload is encrypted client-side (AES-256) and uploaded to IPFS.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                Student Name
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Student Wallet
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  value={studentAddress}
                  onChange={(e) => setStudentAddress(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label className="text-sm">
                Degree
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                />
              </label>
              <label className="text-sm">
                GPA (for commitment)
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                />
              </label>
              <label className="text-sm">
                Local Secret Key (AES-256)
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Student must keep this safe"
                />
              </label>
              <label className="text-sm">
                Salt (kept local; used in commitment)
                <div className="mt-1 flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                    value={salt}
                    onChange={(e) => setSalt(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setSalt(randomSalt())}
                    className="rounded-md border border-slate-600 px-3 py-2 text-sm"
                  >
                    Regenerate
                  </button>
                </div>
              </label>
            </div>
            <button
              onClick={handleIssue}
              disabled={loading || !connected}
              className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Issuing…' : 'Issue Credential'}
            </button>
            {issueStatus && <p className="mt-3 text-sm text-slate-200">{issueStatus}</p>}
          </article>
        )}

        {tab === 'revoke' && (
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Revoke Credential</h2>
            <label className="mt-4 block text-sm">
              Token ID
              <input
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="123"
              />
            </label>
            <button
              onClick={handleRevoke}
              disabled={loading || !connected}
              className="mt-4 rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Revoking…' : 'Revoke Token'}
            </button>
            {revokeStatus && <p className="mt-3 text-sm text-slate-200">{revokeStatus}</p>}
          </article>
        )}
      </section>
    </main>
  );
}
