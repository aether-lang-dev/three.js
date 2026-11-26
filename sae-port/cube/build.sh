#!/bin/sh
# dist/three-sae.js: three-sae.js as one ES module, for a sae page to import.
# dist/readme_cube.js: the same as a classic script with readme_cube.js after
# it, for Node or tools/saejs.
#   ESBUILD=/path/to/esbuild sae-port/cube/build.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
ESBUILD=${ESBUILD:-esbuild}
mkdir -p "$here/dist"
"$ESBUILD" "$here/three-sae.js" --bundle --format=esm --target=es2020 --log-level=warning --outfile="$here/dist/three-sae.js"
"$ESBUILD" "$here/three-sae.js" --bundle --format=iife --global-name=THREE --target=es2020 --log-level=warning --outfile="$here/dist/three-sae.iife.js"
cat "$here/dist/three-sae.iife.js" "$here/readme_cube.js" > "$here/dist/readme_cube.js"
