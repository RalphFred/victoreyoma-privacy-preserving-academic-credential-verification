'use client';

import { useState } from 'react';
import { formatProofForVerifier } from '../../utils/zkp';
import { getReadOnlyProvider, getAcademicContract, getVerifierContract } from '../../utils/web3';

function statusClass(value) {
  if (value === true) return 'bg-emerald-500/10 text-emerald-200 border-emerald-500';
  if (value === false) return 'bg-rose-500/10 text-rose-200 border-rose-500';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

export default function VerifierPortal() {
  const [tokenId, setTokenId] = useState('');
  const [proofInput, setProofInput] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('Upload proof JSON and enter token ID.');
  const [isVerifying, setIsVerifying] = useState(false);

  const parseProofFile = async (file) => {
    const text = await file.text();
    setProofInput(text);
  };

  const verify = async () => {
    try {
      setIsVerifying(true);
      setStatus('Preparing verification...');
      setResult(null);

      if (!tokenId) throw new Error('Enter Token ID first.');
      let parsed;
      try {
        parsed = JSON.parse(proofInput);
      } catch {
        throw new Error('Invalid JSON file.');
      }

      const proofObj = parsed.proof && parsed.publicSignals ? parsed : parsed.proofObj ? parsed : null;
      if (!proofObj) {
        throw new Error('File should contain {"proof":..., "publicSignals":...}.');
      }

      const proof = proofObj.proof;
      const publicSignals = proofObj.publicSignals || [];
      const payload = formatProofForVerifier({ proof, publicSignals });

      const provider = getReadOnlyProvider();
      const academic = await getAcademicContract(provider);
      const verifier = await getVerifierContract(provider);

      const chainRoot = await academic.credentialRoots(tokenId);
      const computedRoot = BigInt(chainRoot).toString();
      const proofRoot = String(publicSignals[0] ?? '').trim();
      if (!proofRoot) throw new Error('Proof package misses publicSignals[0] root.');
      if (BigInt(computedRoot) !== BigInt(proofRoot)) {
        throw new Error('Proof root does not match on-chain token root.');
      }

      const isValid = await verifier.verifyProof(payload.a, payload.b, payload.c, payload.input);
      setResult(isValid === true);
      setStatus(isValid ? 'Proof is valid for the token.' : 'Proof is invalid.');
    } catch (error) {
      setResult(false);
      setStatus(error.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold">Employer Verification Portal</h1>
        <p className="text-slate-300">Search-style public verification page. No wallet is needed.</p>

        <label className="text-sm">
          Token ID
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="12345"
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          Proof JSON (paste or upload)
          <textarea
            value={proofInput}
            onChange={(e) => setProofInput(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 p-3 font-mono text-xs"
            placeholder='{"proof": {...}, "publicSignals": ["..."]}'
          />
        </label>

        <label className="text-sm">
          Upload proof file
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) parseProofFile(file);
            }}
            className="mt-1 block w-full text-sm text-slate-300"
          />
        </label>

        <button
          onClick={verify}
          disabled={isVerifying}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-60"
        >
          {isVerifying ? 'Verifying…' : 'Verify on-chain'}
        </button>

        <div className={`rounded-lg border p-4 ${statusClass(result)} text-center`}>
          <p className="text-xs text-slate-200">
            Verification result
          </p>
          <p className="mt-1 text-3xl font-bold">
            {result === null ? '—' : result ? 'TRUE / Valid' : 'FALSE / Invalid'}
          </p>
          <p className="mt-2 text-sm text-slate-200">{status}</p>
        </div>
      </section>
    </main>
  );
}
