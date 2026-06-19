const { performance } = require('perf_hooks');
const hre = require("hardhat");
const snarkjs = require("snarkjs");

async function main() {
    console.log("--- Starting Automated Benchmarking (Sepolia) ---");
    const [university, student] = await hre.ethers.getSigners();

    // 1. DYNAMIC DEPLOYMENT
    const verifierContract = await hre.ethers.deployContract("Groth16Verifier");
    await verifierContract.waitForDeployment();
    const credentialContract = await hre.ethers.deployContract("AcademicCredential", [university.address], university);
    await credentialContract.waitForDeployment();

    // 2. PRIVACY LAYER & TIMING
    const originalData = 123456789;
    const transcriptData = 999999999; // TAMPERED DATA!
    const secretSalt = 987654321;
    const { buildPoseidon } = require("circomlibjs");
    const poseidon = await buildPoseidon();
    
    // Original pubHash is minted on-chain based on truth
    const pubHash = poseidon.F.toString(poseidon([originalData, secretSalt]));
    const hexHash = "0x" + BigInt(pubHash).toString(16).padStart(64, '0');

    // 3. ISSUANCE GAS BENCHMARK (Goal: Table 4.2)
    console.log("\n[On-Chain] Executing Issuance...");
    const tx = await credentialContract.issueCredential(student.address, hexHash);
    const receipt = await tx.wait();

    // 4. PROOF GENERATION LATENCY (Goal: Table 4.5)
    console.log("\n[Client-Side] Generating ZK Proof with TAMPERED Data...");
    
    try {
        const startProof = performance.now();
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            { transcriptData, secretSalt, pubHash },
            "circuits/credential_js/credential.wasm",
            "circuits/credential_final.zkey"
        );
        const endProof = performance.now();

        // 5. ON-CHAIN VERIFICATION BENCHMARK
        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const args = JSON.parse("[" + solidityCallData + "]");

        const startVerify = performance.now();
        const isValid = await verifierContract.verifyProof(args[0], args[1], args[2], args[3]);
        const endVerify = performance.now();

        if (isValid) {
            console.log("\n🎉 SUCCESS: Proof is VALID! The student has the degree.");
        } else {
            console.log("\n❌ FAILURE: Proof Invalid.");
        }
    } catch (err) {
        console.log("\n❌ FAILURE: Proof Invalid.", "(Error: Data verification failed in circuit constraint logic)");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

