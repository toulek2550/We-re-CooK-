"""Pack glTF/GLB models into one binary for the game's tiny WebGL renderer.
usage: python3 tools/pack_kaykit.py <out dir> <source dir or file> [<source> ...] [--only name1,name2,...]
  sources: folders of .gltf/.glb files (searched recursively) or single files
  - KayKit .gltf: textured (uses restaurantbits_texture.png)
  - our own .glb (procedural): one flat colour per part (material baseColorFactor) -> stored as vertex colour
Writes kit.bin (float32 positions/normals/uvs, rgba8 colours, uint16 indices; node transforms baked in) and kit.json."""
import json, struct, sys, os, math, glob

def quat_mat(q):
    x, y, z, w = q
    return [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]

def node_xform(n):
    t = n.get('translation', [0, 0, 0]); r = quat_mat(n.get('rotation', [0, 0, 0, 1])); s = n.get('scale', [1, 1, 1])
    def p(v): return [sum(r[i][j]*v[j]*s[j] for j in range(3)) + t[i] for i in range(3)]
    def nrm(v):
        w = [v[j]/s[j] if s[j] else 0 for j in range(3)]; o = [sum(r[i][j]*w[j] for j in range(3)) for i in range(3)]
        l = math.sqrt(sum(a*a for a in o)) or 1; return [a/l for a in o]
    return p, nrm

def read_acc(g, buf, idx):
    a = g['accessors'][idx]; bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]; fmt = {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']]
    size = struct.calcsize(fmt); stride = bv.get('byteStride', size*n); off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for k in range(a['count']):
        vals = struct.unpack_from('<' + fmt*n, buf, off + k*stride); out.append(list(vals) if n > 1 else vals[0])
    return out

def lin2srgb(c):
    return 12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4) - 0.055

def load(path):
    if path.endswith('.glb'):
        d = open(path, 'rb').read(); jl = struct.unpack_from('<I', d, 12)[0]; g = json.loads(d[20:20+jl])
        o = 20 + jl; bl = struct.unpack_from('<I', d, o)[0]; buf = d[o+8:o+8+bl]
    else:
        g = json.load(open(path)); buf = open(os.path.join(os.path.dirname(path), g['buffers'][0]['uri']), 'rb').read()
    P, N, T, I, C = [], [], [], [], []
    def walk(ni, parents):
        n = g['nodes'][ni]; chain = parents + [n]
        if 'mesh' in n:
            for prim in g['meshes'][n['mesh']]['primitives']:
                at = prim['attributes']; pos = read_acc(g, buf, at['POSITION']); nor = read_acc(g, buf, at['NORMAL'])
                textured = 'TEXCOORD_0' in at
                uv = read_acc(g, buf, at['TEXCOORD_0']) if textured else [[-1.0, -1.0]] * len(pos)   # uv < 0 = "no texture, use colour"
                col = [255, 255, 255, 255]
                if not textured:
                    f = g['materials'][prim['material']]['pbrMetallicRoughness'].get('baseColorFactor', [1, 1, 1, 1]) if 'material' in prim else [1, 1, 1, 1]
                    col = [round(lin2srgb(f[k]) * 255) for k in range(3)] + [255]
                idx = read_acc(g, buf, prim['indices']) if 'indices' in prim else list(range(len(pos))); base = len(P)
                for k in range(len(pos)):
                    p, q = pos[k], nor[k]
                    for nd in reversed(chain):
                        fp, fn = node_xform(nd); p = fp(p); q = fn(q)
                    P.append(p); N.append(q); T.append(uv[k]); C.append(col)
                I.extend(i + base for i in idx)
        for c in n.get('children', []): walk(c, chain)
    for root in g['scenes'][g.get('scene', 0)]['nodes']: walk(root, [])
    assert len(P) < 65536, path
    return P, N, T, I, C

def main():
    args = sys.argv[1:]; only = None
    if '--only' in args:
        k = args.index('--only'); only = set(args[k+1].split(',')); del args[k:k+2]
    out, srcs = args[0], args[1:]; files = {}
    for src in srcs:
        found = [src] if os.path.isfile(src) else sorted(glob.glob(os.path.join(src, '**', '*.gl*'), recursive=True))
        for f in found:
            if f.endswith(('.gltf', '.glb')): files.setdefault(os.path.splitext(os.path.basename(f))[0], f)
    names = sorted(n for n in files if only is None or n in only)
    if only: missing = only - set(names); assert not missing, 'missing models: %s' % sorted(missing)
    os.makedirs(out, exist_ok=True); blob = bytearray(); man = {}
    for name in names:
        P, N, T, I, C = load(files[name]); e = {'v': len(P), 'i': len(I)}
        e['min'] = [round(min(p[k] for p in P), 4) for k in range(3)]; e['max'] = [round(max(p[k] for p in P), 4) for k in range(3)]
        e['p'] = len(blob); blob += struct.pack('<%df' % (3*len(P)), *[c for p in P for c in p])
        e['n'] = len(blob); blob += struct.pack('<%df' % (3*len(N)), *[c for p in N for c in p])
        e['t'] = len(blob); blob += struct.pack('<%df' % (2*len(T)), *[c for p in T for c in p])
        e['c'] = len(blob); blob += bytes(c for col in C for c in col)
        e['ix'] = len(blob); blob += struct.pack('<%dH' % len(I), *I)
        while len(blob) % 4: blob += b'\0'
        man[name] = e
    open(os.path.join(out, 'kit.bin'), 'wb').write(blob)
    json.dump({'models': man, 'texture': 'restaurantbits_texture.png'}, open(os.path.join(out, 'kit.json'), 'w'), separators=(',', ':'))
    print(len(man), 'models', len(blob), 'bytes')

main()
