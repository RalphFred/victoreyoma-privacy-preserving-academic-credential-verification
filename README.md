# Privacy-Preserving Academic Credential Verification System

## Overview
This project implements a blockchain-based system for issuing and verifying academic credentials while preserving student privacy using Zero-Knowledge Proofs (ZKPs).

## Problem Statement
Traditional academic credential verification systems are slow, prone to fraud, and expose sensitive personal data. Existing blockchain solutions improve authenticity but often violate data privacy regulations such as GDPR.

## Proposed Solution
The system combines:
- SoulBound NFTs for non-transferable credential ownership
- Off-chain encrypted metadata storage using IPFS
- Zero-Knowledge Proofs (zk-SNARKs) for privacy-preserving verification

## System Architecture
<img width="1054" height="373" alt="image" src="https://github.com/user-attachments/assets/13625be8-8465-4b38-bbbd-2fa4fb1cb335" />

## Technologies Used
- Solidity
- Hardhat
- Circom & SnarkJS
- IPFS (Pinata)
- Ethereum Sepolia Testnet

## How Verification Works
1. University issues a SoulBound credential
2. Student generates a ZK proof locally
3. Employer verifies proof on-chain without seeing private data

## Academic Context
This project is submitted in partial fulfilment of the requirements for the award of the B.Sc. (Hons) in Computer Science.
