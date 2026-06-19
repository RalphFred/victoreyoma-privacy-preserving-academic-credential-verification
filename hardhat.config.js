require("@nomicfoundation/hardhat-toolbox");
// require("hardhat-gas-reporter"); // <--- Add this
require("dotenv").config(); // Load the .env

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/00000000000000000000000000000000";
const PRIVATE_KEY = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: "0.8.20",
  // gasReporter: {
  //   enabled: true,
  //   currency: 'USD',
  //   gasPrice: 20, // Estimated Gwei (standard network cost)
  //   // coinmarketcap: "YOUR_API_KEY", // Optional: for real-time prices
  // },
  networks: {
    // 1. Local Network (What you used before)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // 2. Sepolia Testnet (The new target)
    sepolia: {
      url: SEPOLIA_RPC_URL, // Reads from .env with safe fallback
      accounts: PRIVATE_KEY, // Reads from .env
    },
  },
};
