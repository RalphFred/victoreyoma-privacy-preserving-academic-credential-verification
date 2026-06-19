import { ethers } from "ethers";

export const ROLES = {
  ISSUER: "issuer",
  STUDENT: "student",
  UNKNOWN: "unknown",
};

const ACADEMIC_ARTIFACT = "/artifacts/AcademicCredential.json";
const VERIFIER_ARTIFACT = "/artifacts/Groth16Verifier.json";

function readNetworkChainId() {
  const value = process.env.NEXT_PUBLIC_CHAIN_ID;
  return value ? Number(value) : 31337;
}

function readAddress(key, fallback = "") {
  const value = process.env[key];
  if (!value || !ethers.isAddress(value)) {
    return fallback;
  }
  return value;
}

export function getConfig() {
  return {
    chainId: readNetworkChainId(),
    academicCredentialAddress:
      readAddress("NEXT_PUBLIC_ACADEMIC_CREDENTIAL_ADDRESS", ""),
    verifierAddress: readAddress("NEXT_PUBLIC_VERIFIER_ADDRESS", ""),
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
    pinataGateway:
      process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/",
  };
}

async function loadAbi(artifactPath) {
  const response = await fetch(artifactPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load artifact: ${artifactPath}`);
  }
  const artifact = await response.json();
  return artifact.abi || artifact;
}

async function isAllowedChain(provider) {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  return chainId === getConfig().chainId;
}

export async function connectWallet() {
  if (!window?.ethereum) {
    throw new Error("MetaMask is required");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const chainOk = await isAllowedChain(provider);
  if (!chainOk) {
    throw new Error("Please connect to the configured RPC chain for this dApp");
  }

  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  return { provider, signer, account };
}

export function getReadOnlyProvider(rpcUrl = getConfig().rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getAcademicContract(signerOrProvider) {
  const address = getConfig().academicCredentialAddress;
  if (!address) throw new Error("NEXT_PUBLIC_ACADEMIC_CREDENTIAL_ADDRESS not set");
  const abi = await loadAbi(ACADEMIC_ARTIFACT);
  return new ethers.Contract(address, abi, signerOrProvider);
}

export async function getVerifierContract(signerOrProvider) {
  const address = getConfig().verifierAddress;
  if (!address) throw new Error("NEXT_PUBLIC_VERIFIER_ADDRESS not set");
  const abi = await loadAbi(VERIFIER_ARTIFACT);
  return new ethers.Contract(address, abi, signerOrProvider);
}

export async function resolveRole(account, signerOrProvider) {
  const contract = await getAcademicContract(signerOrProvider);
  const owner = (await contract.owner()).toLowerCase();
  const user = account.toLowerCase();

  if (owner === user) return ROLES.ISSUER;

  try {
    const balance = await contract.balanceOf(account);
    if (balance > 0n) return ROLES.STUDENT;
  } catch {
    // ignore and fall through
  }

  return ROLES.UNKNOWN;
}

export async function getCredentialStats(contract) {
  const issuedFilter = contract.filters.CredentialIssued();
  const events = await contract.queryFilter(issuedFilter, 0, "latest");
  const issuedCount = events.length;
  let activeCount = 0;

  for (const event of events) {
    const tokenId = event.args?.tokenId;
    if (tokenId === undefined) continue;

    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner && owner !== ethers.ZeroAddress) {
        activeCount += 1;
      }
    } catch {
      // token burned or inaccessible
    }
  }

  return {
    totalIssued: issuedCount,
    activeCount,
    pendingVerifications: Math.max(issuedCount - activeCount, 0),
  };
}

export async function getOwnedTokenIds(contract, ownerAddress) {
  if (!contract?.target) return [];
  const provider = contract.runner?.provider;
  if (!provider) return [];

  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const ownerTopic = `0x${ownerAddress
    .replace(/^0x/i, "")
    .toLowerCase()
    .padStart(64, "0")}`;

  const logs = await provider.getLogs({
    address: contract.target,
    fromBlock: 0,
    toBlock: "latest",
    topics: [transferTopic, null, ownerTopic],
  });

  const tokenIds = new Set();
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      const tokenId = parsed.args?.tokenId?.toString();
      if (tokenId) tokenIds.add(tokenId);
    } catch {
      // ignore invalid logs
    }
  }

  const owned = [];
  for (const tokenId of tokenIds) {
    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner?.toLowerCase() === ownerAddress.toLowerCase()) {
        const merkleRoot = await contract.credentialRoots(tokenId);
        owned.push({ tokenId, merkleRoot });
      }
    } catch {
      // token might be burned
    }
  }

  return owned.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
}

export async function getTokenRoot(contract, tokenId) {
  return contract.credentialRoots(tokenId);
}

export async function issueCredentialTx(contract, studentAddress, merkleRoot) {
  if (typeof contract.issueCredential === "function") {
    return contract.issueCredential(studentAddress, merkleRoot);
  }

  if (typeof contract.safeMint === "function") {
    return contract.safeMint(studentAddress, merkleRoot);
  }

  throw new Error("No supported issue method found on contract (issueCredential/safeMint).");
}

export async function revokeCredentialTx(contract, tokenId) {
  if (typeof contract.revokeCredential === "function") {
    return contract.revokeCredential(tokenId);
  }

  if (typeof contract.revokeCertificate === "function") {
    return contract.revokeCertificate(tokenId);
  }

  throw new Error("No supported revocation method found on contract (revokeCredential/revokeCertificate).");
}

export function toBytes32FromDecimal(decimalString) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(decimalString), 32), 32);
}

export function bytes32ToDecimal(bytes32) {
  return BigInt(bytes32).toString();
}

export async function safeSwitchToChain(targetChainId) {
  if (!window?.ethereum) throw new Error("MetaMask is required");

  const targetHex = `0x${targetChainId.toString(16)}`;
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: targetHex }],
  });
}
