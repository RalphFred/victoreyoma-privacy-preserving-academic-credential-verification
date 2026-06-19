import { groth16 } from "snarkjs";

export function normalizeBigIntString(value) {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return BigInt(Math.floor(value)).toString();
  return BigInt(String(value)).toString();
}

export async function generateCredentialProof({ transcriptData, secretSalt, pubHash }) {
  const input = {
    transcriptData: normalizeBigIntString(transcriptData),
    secretSalt: normalizeBigIntString(secretSalt),
    pubHash: normalizeBigIntString(pubHash),
  };

  const { proof, publicSignals } = await groth16.fullProve(
    input,
    "/artifacts/credential.wasm",
    "/artifacts/credential_final.zkey",
  );

  return {
    proof,
    publicSignals,
    signal: input.pubHash,
  };
}

export function formatProofForVerifier(proofObj) {
  const { proof } = proofObj;
  return {
    a: [normalizeBigIntString(proof.pi_a[0]), normalizeBigIntString(proof.pi_a[1])],
    b: [
      [normalizeBigIntString(proof.pi_b[0][1]), normalizeBigIntString(proof.pi_b[0][0])],
      [normalizeBigIntString(proof.pi_b[1][1]), normalizeBigIntString(proof.pi_b[1][0])],
    ],
    c: [normalizeBigIntString(proof.pi_c[0]), normalizeBigIntString(proof.pi_c[1])],
    input: proofObj.publicSignals.map((s) => normalizeBigIntString(s)),
  };
}

export async function verifyProofOnChain(verifierContract, proofObj) {
  const payload = formatProofForVerifier(proofObj);
  const result = await verifierContract.verifyProof(
    payload.a,
    payload.b,
    payload.c,
    payload.input,
  );
  return result;
}

export function buildProofSharePackage({ tokenId, proofObj, merkleRoot }) {
  return {
    tokenId: String(tokenId),
    merkleRoot: normalizeBigIntString(merkleRoot),
    publicSignals: proofObj.publicSignals,
    proof: proofObj.proof,
    version: "ppacvs-proof-v1",
  };
}
