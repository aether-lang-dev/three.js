#!/bin/sh
# Runs the checks and the bench on one engine and writes its lines.
#   sae-port/bench/run.sh node    > results/<box>-node.jsonl
#   sae-port/bench/run.sh saejs   > results/<box>-sae.jsonl   (SAEJS=path to sae's target/saejs)
# Checks first: the "check" line must be the same on every engine
# (cmp the first lines), then table.py tabulates the timings.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
case "$1" in
  node)    exec node "$here/dist/bench.js" ;;
  jitless) exec node --jitless "$here/dist/bench.js" ;;
  saejs)   SAE_TIME_LIMIT=600000 exec "${SAEJS:-../sae/target/saejs}" "$here/dist/bench.js" ;;
  *) echo "usage: run.sh node|jitless|saejs" >&2; exit 2 ;;
esac
