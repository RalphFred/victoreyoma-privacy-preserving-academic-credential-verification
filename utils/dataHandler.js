require("dotenv").config();
const { PinataSDK } = require("pinata-web3");
const crypto = require("crypto");
const fs = require("fs");
const { buildPoseidon } = require("circomlibjs");

// 1. SETUP PINATA
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.GATEWAY_URL,
});

// 2. CONSTANTS
const ENCRYPTION_ALGORITHM = "aes-256-cbc";
// In production, this key comes from the student. For now, we generate a random one.
const MOCK_SECRET_KEY = crypto.randomBytes(32); 
const IV_LENGTH = 16;

async function processAndUploadData(studentName, gpa, major) {
    console.log(`\n--- 🚀 Starting Real IPFS Upload for: ${studentName} ---`);

    // ----------------------------------------------------
    // STEP A: Format Data (JSON-LD)
    // ----------------------------------------------------
    const transcript = {
        "@context": "https://www.w3.org/2018/credentials/v1",
        "type": ["VerifiableCredential", "UniversityDegree"],
        "credentialSubject": {
            "name": studentName,
            "degree": major,
            "gpa": gpa
        }
    };
    const jsonString = JSON.stringify(transcript);
    console.log("✅ 1. Data Formatted (JSON-LD)");

    // ----------------------------------------------------
    // STEP B: Encrypt Data (AES-256)
    // ----------------------------------------------------
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, MOCK_SECRET_KEY, iv);
    let encrypted = cipher.update(jsonString);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // This object is what we actually upload to IPFS
    const securePayload = {
        iv: iv.toString('hex'),
        data: encrypted.toString('hex')
    };
    console.log("✅ 2. Data Encrypted Locally");

    // ----------------------------------------------------
    // STEP C: Upload to IPFS (The Real Deal)
    // ----------------------------------------------------
    console.log("⏳ 3. Uploading to IPFS (Pinata)... please wait...");
    
    try {
        // We upload the JSON object directly
        const upload = await pinata.upload.json(securePayload);
        const ipfsHash = upload.IpfsHash;
        
        console.log(`🎉 4. UPLOAD SUCCESS!`);
        console.log(`   - CID: ${ipfsHash}`);
        console.log(`   - View at: https://gateway.pinata.cloud/ipfs/${ipfsHash}`);

        // ----------------------------------------------------
        // STEP D: Hash for ZK Circuit (Poseidon)
        // ----------------------------------------------------
        // We still need the numeric hash for the ZKP circuit
        const secretSalt = 987654321; 
        const transcriptNumeric = parseInt(gpa * 100); 
        
        const poseidon = await buildPoseidon();
        const pubHash = poseidon.F.toString(poseidon([transcriptNumeric, secretSalt]));
        
        console.log(`✅ 5. ZKP Commitment Created: ${pubHash}`);

        return { ipfsHash, pubHash };

    } catch (error) {
        console.error("❌ IPFS Upload Failed:", error);
    }
}

// Run the function
processAndUploadData("Victor Eyoma", 3.8, "Computer Science");