const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CredentialSystem", (m) => {
  // 1. Deploy the Verifier Contract first
  // Note: SnarkJS usually names the contract "Groth16Verifier" inside Verifier.sol
  const verifier = m.contract("Groth16Verifier");

  // 2. Deploy the Academic Credential Contract
  // The constructor requires an 'initialOwner'. We use the account deploying it.
  const deployer = m.getAccount(0);
  const credential = m.contract("AcademicCredential", [deployer]);

  // Return them so we can interact with them later
  return { verifier, credential };
});