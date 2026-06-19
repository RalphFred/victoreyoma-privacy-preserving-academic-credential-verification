// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Updated for newer Solidity versions

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AcademicCredential is ERC721, Ownable {
    uint256 private _nextTokenId; // Replaces 'Counters'

    // Mapping from TokenID to the Public Merkle Root (The "Public Commitment")
    mapping(uint256 => bytes32) public credentialRoots;

    // Event log for off-chain indexing
    event CredentialIssued(address indexed student, uint256 tokenId, bytes32 merkleRoot);

    // Constructor now requires passing the initial owner address
    constructor(address initialOwner)
        ERC721("UniversityDegree", "UDEG")
        Ownable(initialOwner)
    {}

    // 1. Issue Function (Only University can call this)
    function issueCredential(address student, bytes32 merkleRoot) public onlyOwner {
        uint256 tokenId = _nextTokenId++; // Manually increment ID
        
        _safeMint(student, tokenId);
        credentialRoots[tokenId] = merkleRoot;

        emit CredentialIssued(student, tokenId, merkleRoot);
    }

    // 2. SoulBound Logic (Disable Transfers)
    // In OpenZeppelin v5, we only need to override 'transferFrom' to block transfers.
    // 'safeTransferFrom' calls 'transferFrom' internally, so this covers everything.
    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        // Allow minting (from 0) and burning (to 0), but block everything else
        if (from != address(0) && to != address(0)) {
            revert("Err: This credential is SoulBound and cannot be transferred.");
        }
        super.transferFrom(from, to, tokenId);
    }

    // 3. Revocation (Right to be Forgotten / Error Correction)
    function revokeCredential(uint256 tokenId) public onlyOwner {
        _burn(tokenId);
    }
}