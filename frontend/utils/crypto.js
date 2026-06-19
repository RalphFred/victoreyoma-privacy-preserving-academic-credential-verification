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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ALGORITHM = "AES-GCM";
const SALT_SIZE = 16;
const IV_SIZE = 12;

async function getAesKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256",
    },
    baseKey,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

function assertBrowserCryptoAvailable() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Browser crypto API is not available.");
  }
}

export async function encryptCredential(payload, decryptionKey) {
  if (!decryptionKey || !decryptionKey.trim()) {
    throw new Error("A decryption key is required");
  }

  assertBrowserCryptoAvailable();

  const plainBytes = encoder.encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await getAesKey(decryptionKey, salt);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    plainBytes,
  );

  return JSON.stringify({
    v: 1,
    alg: ALGORITHM,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptCredential(ciphertext, decryptionKey) {
  if (!decryptionKey || !decryptionKey.trim()) {
    throw new Error("A decryption key is required");
  }
  if (!ciphertext || typeof ciphertext !== "string") {
    throw new Error("Payload ciphertext is missing");
  }

  assertBrowserCryptoAvailable();

  let parsed;
  try {
    parsed = JSON.parse(ciphertext);
  } catch {
    throw new Error("Credential payload format is unsupported");
  }

  if (!parsed || parsed.alg !== ALGORITHM || !parsed.salt || !parsed.iv || !parsed.data) {
    throw new Error("Invalid encrypted credential format");
  }

  const salt = fromBase64(parsed.salt);
  const iv = fromBase64(parsed.iv);
  const ciphertextBytes = fromBase64(parsed.data);
  const key = await getAesKey(decryptionKey, salt);
  const plainBytes = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    ciphertextBytes,
  );

  const raw = decoder.decode(plainBytes);
  if (!raw) {
    throw new Error("Invalid key or corrupted payload");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid credential payload");
  }
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
