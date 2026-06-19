const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Baseline Model A (On-Chain Storage) - Performance Test", function () {
  let baselineContract;
  let university, student;

  before(async function () {
    [university, student] = await ethers.getSigners();

    // Deploy the Baseline Contract
    const Baseline = await ethers.getContractFactory("BaselineCredential");
    baselineContract = await Baseline.deploy(university.address);
    await baselineContract.waitForDeployment();
    
    console.log("Baseline Contract Deployed to:", await baselineContract.getAddress());
  });

  it("Should measure the high gas cost of storing full data on-chain", async function () {
    // We simulate a real transcript payload
    const name = "Victor Eyoma";
    const degree = "Bachelor of Science in Computer Science"; 
    const gpa = "3.5 / 4.0"; 
    const date = "December 2025";

    // Send the transaction
    const tx = await baselineContract.connect(university).issueCredential(
      student.address,
      name,
      degree,
      gpa,
      date
    );
    
    const receipt = await tx.wait();
    console.log(`\n[GAS COST] Model A Issuance Used: ${receipt.gasUsed} Gas`);
    
    // Simple check to ensure it worked
    expect(await baselineContract.ownerOf(0)).to.equal(student.address);
  });
});