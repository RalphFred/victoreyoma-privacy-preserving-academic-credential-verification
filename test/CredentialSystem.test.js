const { expect } = require("chai");
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

describe("Credential System Performance Benchmark", function () {
  let credentialContract, verifierContract;
  let university, student;
  let pubHash, transcriptData, secretSalt;

  // SETUP: Runs once before the tests
  before(async function () {
    [university, student] = await ethers.getSigners();

    // 1. Deploy Verifier
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    verifierContract = await Verifier.deploy();
    await verifierContract.waitForDeployment();

    // 2. Deploy Credential Registry
    const Credential = await ethers.getContractFactory("AcademicCredential");
    credentialContract = await Credential.deploy(university.address);
    await credentialContract.waitForDeployment();

    // 3. Prepare Data (Privacy Layer)
    transcriptData = 123456789;
    secretSalt = 987654321;
    const poseidon = await buildPoseidon();
    const pubHashBigInt = poseidon([transcriptData, secretSalt]);
    pubHash = poseidon.F.toString(pubHashBigInt);
  });

  // TEST 1: Measure Cost of Minting (Issuance)
  it("Should measure gas cost for Issuing a Credential", async function () {
    const tx = await credentialContract.connect(university).issueCredential(
      student.address,
      "0x" + BigInt(pubHash).toString(16).padStart(64, '0')
    );
    await tx.wait();
    // The Gas Reporter will catch this transaction automatically
    expect(await credentialContract.ownerOf(0)).to.equal(student.address);
  });

  // TEST 2: Measure Cost of Verification
  it("Should measure gas cost for Verifying a Proof", async function () {
    // Generate Proof (Off-Chain)
    const input = {
      transcriptData: transcriptData,
      secretSalt: secretSalt,
      pubHash: pubHash
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "circuits/credential_js/credential.wasm",
      "circuits/credential_final.zkey"
    );

    // Prepare for On-Chain Call
    const solidityCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const args = JSON.parse("[" + solidityCallData + "]");
    
    // Verify On-Chain
    const tx = await verifierContract.verifyProof(args[0], args[1], args[2], args[3]);
    await tx.wait();
    
    // We don't assert true/false here because we just want the gas cost, 
    // but typically we would expect(result).to.be.true;
  });
});