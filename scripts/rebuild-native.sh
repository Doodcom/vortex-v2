#!/usr/bin/env bash
# Rebuild better-sqlite3 against Electron headers with CachyOS/Zen4 native flags.
# Bypasses prebuild-install (which downloads Debian GCC-12 prebuilts from GitHub).
# Requires: ~/.gyp/include.gypi with znver4 flags, node-gyp installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ_DIR="$(dirname "$SCRIPT_DIR")"
ELECTRON_VERSION="$("$PROJ_DIR/node_modules/.bin/electron" --version | tr -d 'v')"
HEADERS_DIR="$HOME/.cache/node-gyp/$ELECTRON_VERSION"
PKG_DIR="$PROJ_DIR/node_modules/better-sqlite3"

echo "==> Electron $ELECTRON_VERSION | headers: $HEADERS_DIR"

if [[ ! -d "$HEADERS_DIR/include/node" ]]; then
  echo "==> Downloading Electron headers..."
  node-gyp install --target="$ELECTRON_VERSION" --arch=x64 \
    --dist-url=https://electronjs.org/headers
fi

echo "==> Configuring better-sqlite3..."
cd "$PKG_DIR"
rm -rf build
node-gyp configure \
  --target="$ELECTRON_VERSION" \
  --arch=x64 \
  --nodedir="$HEADERS_DIR"

echo "==> Building with $(nproc) cores..."
make -j"$(nproc)" -C build

echo "==> Done."
SIMD=$(objdump -d "build/Release/better_sqlite3.node" | grep -c "ymm\|zmm" || true)
GCC=$(readelf -p .comment "build/Release/better_sqlite3.node" 2>/dev/null | grep GCC | head -1 | xargs || true)
echo "    SIMD: $SIMD  |  $GCC"
