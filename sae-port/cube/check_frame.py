# The README cube, three.js's batches drawn by ae3d, held to what three.js
# says the picture must be (readme_cube.js). MIT.
#
#   python3 check_frame.py split DUMP OUTDIR    # the dump's batches as OUTDIR/frame<n>.bin
#   python3 check_frame.py check DUMP OUTDIR    # OUTDIR/batch<n>.png held to the dump's faces
#
# "check" needs Pillow. A face's centre must be its colour to 2/255, the
# corners the clear colour, and the frames must differ.
import json, sys, os

def frames(dump):
    lines = [l.strip() for l in open(dump) if l.strip()]
    return [(json.loads(lines[i]), bytes.fromhex(lines[i + 1])) for i in range(0, len(lines), 2)]

def split(dump, out):
    os.makedirs(out, exist_ok=True)
    paths = []
    for n, (_, data) in enumerate(frames(dump), 1):
        p = os.path.join(out, f'frame{n}.bin')
        open(p, 'wb').write(data)
        paths.append(p)
    print(' '.join(paths))

def check(dump, out):
    from PIL import Image
    failures = 0
    pictures = []
    for n, (want, _) in enumerate(frames(dump), 1):
        im = Image.open(os.path.join(out, f'batch{n}.png')).convert('RGBA')
        w, h = im.size
        px = im.load()
        pictures.append(im.tobytes())
        covered = sum(1 for y in range(h) for x in range(w) if px[x, y][:3] != (0, 0, 0))
        for face in want['faces']:
            got = px[face['x'], face['y']][:3]
            ok = all(abs(g - e) <= 2 for g, e in zip(got, face['rgb']))
            failures += not ok
            print(f"  {'ok  ' if ok else 'FAIL'} t={want['time']}: face {face['face']} at ({face['x']}, {face['y']}) is {got}, three.js says {tuple(face['rgb'])}")
        corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
        ok = all(c[:3] == (0, 0, 0) for c in corners) and 1000 < covered < w * h // 4
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} t={want['time']}: {covered} pixels covered, the corners clear")
    differ = sum(1 for a, b in zip(pictures[0][0::4], pictures[1][0::4]) if a != b)
    ok = differ > 200
    failures += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} the frames differ in {differ} pixels")
    print('check_frame: ' + ('ok' if failures == 0 else f'{failures} failed'))
    sys.exit(1 if failures else 0)

if __name__ == '__main__':
    {'split': split, 'check': check}[sys.argv[1]](sys.argv[2], sys.argv[3])
