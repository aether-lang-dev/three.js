# Tabulates run.sh's lines in results/: python3 table.py  (MIT)
# Files are <box>-<engine>.jsonl, engine node, node-jitless or sae.
import json, sys, os, glob
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
runs, checks = {}, set()
for f in sorted(glob.glob(os.path.join(d, '*.jsonl'))):
    name = os.path.basename(f)[:-6]
    runs[name] = {}
    for l in open(f):
        j = json.loads(l)
        if 'check' in j: checks.add(l)
        if 'time' in j: runs[name][j['time']] = j['ms']
print(f'checks: {len(runs)} runs, {len(checks)} distinct check line(s)')
cols = [c for c in ['mac-node', 'mac-node-jitless', 'mac-sae', 'cachyos-node', 'cachyos-node-jitless', 'cachyos-sae', 'ae-x64-sae'] if c in runs]
print('| ms per call | ' + ' | '.join(cols) + ' | sae/Node, Mac | sae/jitless, Mac | sae/Node, cachyos |')
print('|---|' + '--:|' * (len(cols) + 3))
for k in runs['mac-node']:
    r = lambda c: runs[c][k]
    print(f'| {k} | ' + ' | '.join(f'{r(c):.3f}' for c in cols) +
          f" | {r('mac-sae')/r('mac-node'):.0f}x | {r('mac-sae')/r('mac-node-jitless'):.1f}x | {r('cachyos-sae')/r('cachyos-node'):.0f}x |")
