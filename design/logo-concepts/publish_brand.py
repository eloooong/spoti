"""Publish the approved Tasteprint S artwork to the website and README."""
from pathlib import Path
from io import BytesIO
import re
import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parents[1] / 'client' / 'public'
BRAND = PUBLIC / 'brand'
BRAND.mkdir(exist_ok=True)
symbol = (ROOT/'round-03/tasteprint-s-v2-symbol.svg').read_text(encoding='utf-8')
symbol = re.sub(r'<title.*?</title>', '<title id="title">SpotiStats Tasteprint S</title>', symbol)
lockup = (ROOT/'round-03/tasteprint-s-v2-lockup.svg').read_text(encoding='utf-8')
lockup = re.sub(r'<title.*?</title>', '<title id="title">SpotiStats</title>', lockup)
lockup = lockup.replace('#111111','#f3f5f3')
lockup = re.sub(r'(<g transform="translate\(0 24\) scale\(0.8125\)">)(.*?)(</g>)',lambda match: match[1]+match[2].replace('#f3f5f3','#1ed760')+match[3],lockup)
(BRAND/'spotistats-logo.svg').write_text(lockup,encoding='utf-8')
(BRAND/'spotistats-symbol.svg').write_text(symbol.replace('#111111','#1ed760'),encoding='utf-8')

artwork = re.sub(r'^.*?</title>|</svg>\s*$','',symbol).replace('#111111','#111812')
icon = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title"><title id="title">SpotiStats</title><rect width="256" height="256" rx="56" fill="#1ed760"/>{artwork}</svg>\n'
(PUBLIC/'favicon.svg').write_text(icon,encoding='utf-8')
png = resvg_py.svg_to_bytes(svg_string=icon,width=256,height=256)
Image.open(BytesIO(png)).save(PUBLIC/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)])
(PUBLIC/'apple-touch-icon.png').write_bytes(resvg_py.svg_to_bytes(svg_string=icon,width=180,height=180,background='#1ed760'))
banner_logo = re.sub(r'<title.*?</title>|\s(role|aria-labelledby)="[^"]*"','',lockup)
banner_logo = re.sub(r'<svg[^>]*>','<svg x="330" y="32" width="620" height="175" viewBox="0 0 907 256">',banner_logo,count=1)
banner = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 240" width="1280" height="240" role="img" aria-labelledby="title"><title id="title">SpotiStats</title><rect width="1280" height="240" rx="24" fill="#111412"/>'+banner_logo.strip()+'</svg>\n'
(ROOT.parents[1]/'docs/assets/spotistats-banner.svg').write_text(banner,encoding='utf-8')
print('Published Tasteprint S header logo, symbol, web icons, and GitHub banner.')
