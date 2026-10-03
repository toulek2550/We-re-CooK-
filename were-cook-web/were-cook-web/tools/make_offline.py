"""Opening public/index.html straight from the folder (file://) blocks fetch() and WebGL textures from files.
This packs the 3D data into plain <script> files the game can load in that case.
   python3 tools/make_offline.py   ->  public/3d/kit-data.js + public/3d/icons-data.js  (run again after re-packing kit.bin or icons)"""
import base64, json, os
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', '3d')
b64 = lambda f: base64.b64encode(open(os.path.join(D, f), 'rb').read()).decode()
kit = {'json': json.load(open(os.path.join(D, 'kit.json'))), 'bin': b64('kit.bin'), 'tex': 'data:image/png;base64,' + b64('restaurantbits_texture.png')}
open(os.path.join(D, 'kit-data.js'), 'w').write('window.KIT_DATA=' + json.dumps(kit, separators=(',', ':')) + ';\n')
ic = json.load(open(os.path.join(D, 'icons.json'))); ic['dataUrl'] = 'data:image/webp;base64,' + b64(ic['file'])
open(os.path.join(D, 'icons-data.js'), 'w').write('window.ICON_DATA=' + json.dumps(ic, separators=(',', ':')) + ';\n')
print('ok', os.path.getsize(os.path.join(D, 'kit-data.js')), os.path.getsize(os.path.join(D, 'icons-data.js')))
