#!/usr/bin/env bash

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not found. Install Node.js 18+ and retry."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found. Install npm (bundled with Node.js) and retry."
  exit 1
fi

echo "[MVP] Installing root dependencies"
npm install

echo "[MVP] Installing frontend dependencies"
cd frontend
npm install
cd ..

echo "[MVP] Compiling contracts"
npm run compile

echo "[MVP] Local launch flow:"
echo "1) Terminal 1: npm run node"
echo "2) Terminal 2: npm run deploy:local"
echo "   Copy deployed address into frontend/.env.local"
echo "3) Terminal 3: npm run frontend:dev"
