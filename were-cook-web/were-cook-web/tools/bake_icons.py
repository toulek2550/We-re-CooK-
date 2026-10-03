"""Bake the 3D icon sprite sheet (needs Python + Playwright with Chromium).
   python3 tools/bake_icons.py      ->  public/3d/icons.webp + public/3d/icons.json"""
import asyncio, base64, io, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8799'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            page = await br.new_page(viewport={'width': 400, 'height': 400})
            page.on('console', lambda m: print('console:', m.text))
            await page.goto('http://localhost:8799/tools/bake_icons.html'); await page.wait_for_function("document.title!==''", timeout=600000)
            t = await page.title(); assert t == 'done', t
            r = await page.evaluate('window.RESULT'); await br.close()
    finally:
        srv.terminate()
    png = base64.b64decode(r.pop('png').split(',')[1])
    from PIL import Image
    im = Image.open(io.BytesIO(png)); im.save(os.path.join(ROOT, 'public/3d/icons.webp'), 'WEBP', quality=88, method=6)
    r['file'] = 'icons.webp'; json.dump(r, open(os.path.join(ROOT, 'public/3d/icons.json'), 'w'), separators=(',', ':'))
    print(len(r['icons']), 'icons', im.size, 'missing:', r['missing'], os.path.getsize(os.path.join(ROOT, 'public/3d/icons.webp')), 'bytes')
asyncio.run(main())
