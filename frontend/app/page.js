'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { connectWallet, resolveRole, getAcademicContract, ROLES } from '../utils/web3';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState('Connect MetaMask to be routed by role.');
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const enterByWallet = async () => {
    try {
      setIsConnecting(true);
      setStatus('Requesting wallet...');
      const { provider, account } = await connectWallet();
      setAccount(account);
      const contract = await getAcademicContract(provider);
      const role = await resolveRole(account, contract);

      if (role === ROLES.ISSUER) {
        setStatus('Issuer role detected. Redirecting...');
        router.push('/issuer');
        return;
      }

      if (role === ROLES.STUDENT) {
        setStatus('Student role detected. Redirecting...');
        router.push('/student');
        return;
      }

      setStatus(
        `Connected as ${account.slice(0, 6)}...${account.slice(-4)}. No ACL match found, open Student portal manually.`
      );
    } catch (error) {
      setStatus(error.message || 'Wallet connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16 md:px-10">
        <header className="space-y-4">
          <p className="inline-flex rounded-full border border-emerald-400/50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-300">
            PPACVS DApp
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Privacy-Preserving Academic Credential Verification
          </h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Students receive SoulBound academic credentials on-chain. Universities mint them
            against a Poseidon commitment, while students prove ownership with zk-SNARK proofs
            that reveal no PII.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ul className="mt-4 space-y-2 text-slate-300">
            <li>1) University issues a SoulBound NFT to the student address.</li>
            <li>2) Academic details are encrypted in IPFS with AES-256 and only the student key can decrypt.</li>
            <li>3) The student proves secret GPA + salt against the on-chain commitment using Groth16.</li>
            <li>4) Employer verifies only the boolean proof result against a public verifier contract.</li>
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/issuer"
            className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-indigo-200 transition hover:bg-indigo-500/20"
          >
            <p className="font-medium">University Portal</p>
            <p className="text-sm text-slate-400">Issue and revoke credentials (issuer role).</p>
          </Link>
          <Link
            href="/student"
            className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-4 text-fuchsia-200 transition hover:bg-fuchsia-500/20"
          >
            <p className="font-medium">Student Wallet</p>
            <p className="text-sm text-slate-400">View SBT credentials and generate proofs.</p>
          </Link>
          <Link
            href="/verifier"
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <p className="font-medium">Employer Verification</p>
            <p className="text-sm text-slate-400">Public proof verification, no wallet required.</p>
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Gateway</h2>
          <p className="mt-2 text-slate-300">{status}</p>
          {account && <p className="mt-1 text-sm text-slate-400">Connected: {account}</p>}
          <button
            onClick={enterByWallet}
            disabled={isConnecting}
            className="mt-4 inline-flex rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet & Route'}
          </button>
        </div>
      </section>
    </main>
  );
}
