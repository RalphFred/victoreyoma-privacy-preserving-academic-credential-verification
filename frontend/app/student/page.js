'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { connectWallet, getAcademicContract, getOwnedTokenIds, resolveRole, ROLES, bytes32ToDecimal } from '../../utils/web3';
import { decryptCredential as decryptPayload } from '../../utils/crypto';
import { generateCredentialProof, buildProofSharePackage } from '../../utils/zkp';
import { getCidForToken, setCidForToken } from '../../utils/credentialIndex';
import { getConfig } from '../../utils/web3';

function toTokenRows(tokens) {
  return tokens.map((token) => ({
    tokenId: String(token.tokenId),
    merkleRoot: token.merkleRoot || '',
  }));
}

async function loadIpfsBundle(cid) {
  const gateway = getConfig().pinataGateway.replace(/\/$/, '');
  const response = await fetch(`${gateway}/${cid}`);
  if (!response.ok) {
    throw new Error(`Unable to load IPFS artifact: ${response.statusText}`);
  }
  return response.json();
}

export default function StudentPortal() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [connected, setConnected] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [roleError, setRoleError] = useState('');

  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [selectedCid, setSelectedCid] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [cidInputByToken, setCidInputByToken] = useState({});

  const [proofPackage, setProofPackage] = useState(null);
  const [proofStatus, setProofStatus] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const hasTokens = tokens.length > 0;
  const tokenRows = useMemo(() => toTokenRows(tokens), [tokens]);

  const connectAsStudent = async () => {
    try {
      setIsBusy(true);
      setRoleError('');
      const { provider, account } = await connectWallet();
      const c = await getAcademicContract(provider);
      const role = await resolveRole(account, c);
      if (role !== ROLES.STUDENT && role !== ROLES.ISSUER) {
        throw new Error('This address currently does not hold credentials for this portal.');
      }
      setAccount(account);
      setContract(c);
      setConnected(true);
      const owned = await getOwnedTokenIds(c, account);
      const rows = toTokenRows(owned);
      const withCidDefaults = rows.map((r) => ({
        ...r,
        cid: getCidForToken(r.tokenId),
      }));
      setTokens(withCidDefaults);
      const map = {};
      for (const row of withCidDefaults) map[row.tokenId] = row.cid;
      setCidInputByToken(map);
      if (rows[0]) setSelectedTokenId(rows[0].tokenId);
    } catch (error) {
      setRoleError(error.message || 'Unable to connect.');
      setConnected(false);
    } finally {
      setIsBusy(false);
    }
  };

  const selectedRoot = useMemo(() => {
    const found = tokenRows.find((row) => row.tokenId === selectedTokenId);
    return found?.merkleRoot || '';
  }, [selectedTokenId, tokenRows]);

  const handleTokenCidChange = (tokenId, value) => {
    setCidInputByToken((prev) => ({
      ...prev,
      [tokenId]: value,
    }));
    if (tokenId === selectedTokenId) setSelectedCid(value);
  };

  const fetchProof = async () => {
    try {
      setIsBusy(true);
      setProofStatus('');
      if (!contract) throw new Error('Connect wallet first.');
      if (!selectedTokenId) throw new Error('Select a token.');
      if (!decryptionKey) throw new Error('Local decryption key is required.');

      const tokenCid = cidInputByToken[selectedTokenId] || selectedCid;
      if (!tokenCid) throw new Error('Attach the credential IPFS CID.');

      const bundle = await loadIpfsBundle(tokenCid);
      const ciphertext = bundle.encryptedPayload || bundle.ciphertext;
      if (!ciphertext) throw new Error('Invalid IPFS payload.');
      const payload = decryptPayload(ciphertext, decryptionKey);

      const transcriptData = payload.transcriptData ?? payload.transcript_data;
      const secretSalt = payload.salt ?? payload.secretSalt;
      if (transcriptData === undefined || secretSalt === undefined) {
        throw new Error('Payload does not include required ZKP inputs.');
      }

      const proofObj = await generateCredentialProof({
        transcriptData,
        secretSalt,
        pubHash: bytes32ToDecimal(selectedRoot || payload.merkleRoot),
      });

      const tokenRoot = bytes32ToDecimal(selectedRoot || payload.merkleRoot);
      const pkg = buildProofSharePackage({
        tokenId: selectedTokenId,
        merkleRoot: tokenRoot,
        proofObj,
      });

      setProofPackage(pkg);
      setCidForToken(selectedTokenId, tokenCid);

      const qrPayload = JSON.stringify(pkg);
      try {
        const qrUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: "M" });
        setQrCode(qrUrl);
      } catch {
        setQrCode('');
      }
      setProofStatus(`✅ Proof generated for token ${selectedTokenId}.`);
    } catch (error) {
      setProofStatus(error.message || 'Proof generation failed.');
      setProofPackage(null);
      setQrCode('');
    } finally {
      setIsBusy(false);
    }
  };

  const downloadProof = () => {
    if (!proofPackage) return;
    const compact = JSON.stringify(proofPackage);
    const blob = new Blob([compact], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `proof-token-${proofPackage.tokenId}.json`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  useEffect(() => {
    setSelectedCid(cidInputByToken[selectedTokenId] || '');
  }, [selectedTokenId, cidInputByToken]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold">Student Credential Wallet</h1>
        <p className="text-slate-300">
          Connect your wallet, view SBT credentials, fetch your encrypted IPFS file, and generate ZK proofs.
        </p>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p>{connected ? `Connected student: ${account}` : roleError || 'Wallet not connected'}</p>
            <button
              onClick={connectAsStudent}
              disabled={isBusy}
              className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {connected ? 'Reconnect Wallet' : 'Connect Wallet'}
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Digital Wallet Gallery</h2>
          {!connected ? (
            <p className="mt-2 text-sm text-slate-400">Connect to load owned credentials.</p>
          ) : tokenRows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              No on-chain credentials detected for this wallet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {tokenRows.map((token) => (
                <article
                  key={token.tokenId}
                  className={`rounded-lg border p-4 ${
                    selectedTokenId === token.tokenId ? 'border-emerald-400 bg-emerald-950/20' : 'border-slate-700'
                  }`}
                >
                  <p className="text-sm text-slate-300">Token ID: {token.tokenId}</p>
                  <p className="mt-1 text-xs text-slate-500 break-all">Public Root: {token.merkleRoot}</p>
                  <label className="mt-2 block text-xs">
                    IPFS CID (same as issued bundle)
                    <input
                      value={cidInputByToken[token.tokenId] || ''}
                      onChange={(e) => handleTokenCidChange(token.tokenId, e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
                      placeholder="Qm..."
                    />
                  </label>
                  <button
                    onClick={() => setSelectedTokenId(token.tokenId)}
                    className="mt-3 rounded-md border border-slate-600 px-3 py-2 text-xs"
                  >
                    Select token
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Generate ZKP Proof</h2>
          <p className="mt-2 text-sm text-slate-400">No PII is shown during verification and only proof signal is exposed.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Token ID
              <select
                value={selectedTokenId}
                onChange={(e) => setSelectedTokenId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
              >
                <option value="">Choose token</option>
                {tokenRows.map((token) => (
                  <option key={token.tokenId} value={token.tokenId}>
                    Token #{token.tokenId}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Local Decryption Key
              <input
                value={decryptionKey}
                onChange={(e) => setDecryptionKey(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                placeholder="Student secret from university"
                type="password"
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              onClick={fetchProof}
              disabled={!connected || !hasTokens || isBusy}
              className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? 'Generating…' : 'Generate Proof'}
            </button>
          </div>

          <p className="mt-4 text-sm text-slate-200">{proofStatus}</p>

          {proofPackage && (
            <div className="mt-4">
              <p className="text-sm text-slate-400">Shareable proof package:</p>
              <textarea
                value={JSON.stringify(proofPackage, null, 2)}
                className="mt-2 h-52 w-full rounded-md border border-slate-600 bg-slate-950 p-3 text-xs text-slate-200"
                readOnly
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={downloadProof}
                  className="rounded-md border border-slate-600 px-4 py-2"
                >
                  Download JSON Proof
                </button>
                {qrCode && <img src={qrCode} alt="Proof QR code" className="h-48 w-48 rounded-md border border-slate-600" />}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Note: If QR does not render, share the downloaded JSON proof file.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
