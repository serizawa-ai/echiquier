#!/usr/bin/env bash
# Télécharge Stockfish 18 (lite, mono-thread) dans ./engine/
set -euo pipefail
BASE="https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0"
mkdir -p engine
for f in stockfish-18-lite-single.js stockfish-18-lite-single.wasm; do
  echo "→ $f"
  curl -fL --progress-bar -o "engine/$f" "$BASE/$f"
done
echo "Moteur installé dans ./engine/ — recharge la page."
