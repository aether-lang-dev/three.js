#!/bin/sh
# Bundles entry.js (three.js's src/math, src/core, src/geometries, unmodified)
# with esbuild into one classic script, then appends bench.js: dist/bench.js
# runs as it is on Node and on sae's engine (tools/saejs from sae).
#   ESBUILD=/path/to/esbuild sae-port/bench/build.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
ESBUILD=${ESBUILD:-esbuild}
mkdir -p "$here/dist"
"$ESBUILD" "$here/entry.js" --bundle --format=iife --global-name=THREE \
    --target=es2020 --log-level=warning --outfile="$here/dist/three-core.js"
cat "$here/dist/three-core.js" "$here/bench.js" > "$here/dist/bench.js"
{ echo 'var BENCH_CHECK_ONLY = 1;'; cat "$here/dist/bench.js"; } > "$here/dist/check.js"
wc -c "$here/dist/three-core.js"
