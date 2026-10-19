"""Publish the approved Replay S artwork to the website's static assets."""
from pathlib import Path
from io import BytesIO
import re
import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parents[1] / 'client' / 'public'
BRAND = PUBLIC / 'brand'
BRAND.mkdir(exist_ok=True)
symbol = (ROOT/'round-02/replay-refined-symbol.svg').read_text(encoding='utf-8')
symbol = re.sub(r'<title.*?</title>', '<title id="title">SpotiStats Replay S</title>', symbol)
lockup = (ROOT/'round-02/replay-refined-lockup.svg').read_text(encoding='utf-8')
lockup = re.sub(r'<title.*?</title>', '<title id="title">SpotiStats</title>', lockup)
lockup = lockup.replace('#111111','#f3f5f3')
lockup = lockup.replace('<g transform="translate(0 24) scale(0.8125)"><path fill="#f3f5f3"', '<g transform="translate(0 24) scale(0.8125)"><path fill="#1ed760"')
(BRAND/'spotistats-logo.svg').write_text(lockup,encoding='utf-8')
(BRAND/'spotistats-symbol.svg').write_text(symbol.replace('#111111','#1ed760'),encoding='utf-8')

path = re.search(r'<path[^>]+d="([^"]+)"',symbol).group(1)
icon = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title"><title id="title">SpotiStats</title><rect width="256" height="256" rx="56" fill="#1ed760"/><path fill="#111812" d="{path}"/></svg>\n'
(PUBLIC/'favicon.svg').write_text(icon,encoding='utf-8')
png = resvg_py.svg_to_bytes(svg_string=icon,width=256,height=256)
Image.open(BytesIO(png)).save(PUBLIC/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)])
(PUBLIC/'apple-touch-icon.png').write_bytes(resvg_py.svg_to_bytes(svg_string=icon,width=180,height=180,background='#1ed760'))
print('Published header logo, symbol, favicon SVG/ICO, and Apple touch icon.')
