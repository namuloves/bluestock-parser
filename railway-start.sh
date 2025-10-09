#!/usr/bin/env bash
set -euo pipefail

if [ ! -d node_modules ] || [ ! -f node_modules/ajv/package.json ]; then
  echo "Installing production dependencies before launch..."
  npm ci --omit=dev
else
  echo "Production dependencies already present. Skipping npm ci."
fi

echo "Starting Bluestock Parser server..."
exec node server.js
