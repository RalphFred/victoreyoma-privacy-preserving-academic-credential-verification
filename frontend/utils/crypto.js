import CryptoJS from "crypto-js";

const JSON_LD_CONTEXT = "https://schema.org/";

export function createCredentialPayload({ studentAddress, studentName, degree, gpa }) {
  const now = new Date().toISOString();
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "EducationalOccupationalCredential",
    issuanceDate: now,
    credentialSubject: {
      id: `did:eth:${studentAddress}`,
      name: studentName,
      degreeName: degree,
      grade: Number(gpa),
    },
  };
}

export function buildTranscriptInputs({ gpa, salt }) {
  const transcriptData = String(Math.floor(Number(gpa) * 100));
  const secretSalt = String(Math.floor(Number(salt)));
  return { transcriptData, secretSalt };
}

export function encryptCredential(payload, decryptionKey) {
  if (!decryptionKey || !decryptionKey.trim()) {
    throw new Error("A decryption key is required");
  }
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(payload), decryptionKey).toString();
  return ciphertext;
}

export function decryptCredential(ciphertext, decryptionKey) {
  if (!decryptionKey || !decryptionKey.trim()) {
    throw new Error("A decryption key is required");
  }
  const bytes = CryptoJS.AES.decrypt(ciphertext, decryptionKey);
  const raw = bytes.toString(CryptoJS.enc.Utf8);
  if (!raw) throw new Error("Invalid key or corrupted payload");
  const parsed = JSON.parse(raw);
  return parsed;
}

export function payloadToStorageBundle({
  ciphertext,
  studentAddress,
  studentName,
  degree,
  gpa,
  transcriptData,
  salt,
  merkleRoot,
}) {
  return {
    version: "1.0.0",
    issuedBy: "University",
    studentAddress,
    studentName,
    degree,
    gpa,
    transcriptData,
    salt,
    merkleRoot,
    encryptedPayload: ciphertext,
    createdAt: new Date().toISOString(),
  };
};
