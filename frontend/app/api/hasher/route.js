import { NextResponse } from 'next/server';
import { buildPoseidon } from 'circomlibjs'; 

export async function POST(request) {
  try {
    const body = await request.json();
    const transcriptData = body?.transcriptData ?? body?.gpa;
    const salt = body?.secretSalt ?? body?.salt;

    if (transcriptData === undefined || transcriptData === null || salt === undefined || salt === null) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    if (!Number.isFinite(Number(transcriptData)) || !Number.isFinite(Number(salt))) {
      return NextResponse.json({ error: "Invalid numeric input" }, { status: 400 });
    }

    // 1. Initialize Hash Function
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // 2. Prepare data values to exactly match the circuit inputs:
    // transcriptData (uint) and secretSalt (uint)
    const preparedTranscript = BigInt(Math.floor(Number(transcriptData)));
    const preparedSalt = BigInt(Math.floor(Number(salt)));

    // 3. Calculate Hash
    const hashBigInt = poseidon([preparedTranscript, preparedSalt]);
    const hashObject = F.toObject(hashBigInt);

    // Convert to decimal string for Solidity compatibility.
    const hashString = hashObject.toString();

    return NextResponse.json({ hash: hashString });

  } catch (error) {
    console.error("Hashing Error:", error);
    return NextResponse.json({ error: "Calculation failed" }, { status: 500 });
  }
}
