pragma circom 2.0.0;

// Import the Poseidon hashing function from the library we just installed
include "../node_modules/circomlib/circuits/poseidon.circom";

template CredentialVerifier() {
    // ---------------------------------------------------------
    // 1. Private Inputs (The Student keeps these secret)
    // ---------------------------------------------------------
    // The numeric representation of your transcript (e.g. hash of the PDF)
    signal input transcriptData; 
    
    // A random number to prevent "brute force" guessing of the hash
    signal input secretSalt;           
    
    // ---------------------------------------------------------
    // 2. Public Inputs (The Employer/Blockchain sees these)
    // ---------------------------------------------------------
    // The "Public Commitment" stored on your SoulBound Token
    signal input pubHash;        

    // ---------------------------------------------------------
    // 3. The Logic (The Constraint System)
    // ---------------------------------------------------------
    
    // Initialize the Poseidon Hasher with 2 inputs
    component hasher = Poseidon(2);
    
    // Feed the private data into the hasher
    hasher.inputs[0] <== transcriptData;
    hasher.inputs[1] <== secretSalt;

    // 4. The "Proof" Check
    // We assert that: Hash(transcript + salt) MUST EQUAL the Public Hash on the blockchain
    // If this math doesn't add up, the proof generation fails.
    pubHash === hasher.out; 
}

// Define the main component and list which inputs are public
component main {public [pubHash]} = CredentialVerifier();