"""Refine Replay's geometry and lockup; preserve the first-round artwork."""
from pathlib import Path
import re
import html
import resvg_py

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'round-02'
OUT.mkdir(exist_ok=True)
ORIGINAL = (ROOT/'round-01/a-replay-v2-symbol.svg').read_text(encoding='utf-8')
WORDMARK = re.search(r'<g id="wordmark".*?</g>',(ROOT/'round-01/a-replay-v2-lockup.svg').read_text(encoding='utf-8')).group(0)
VARIANTS = {
 'a3-balanced': 'M224 32 H96 A56 56 0 0 0 96 144 H160 A24 24 0 0 1 160 192 H64 L32 224 H160 A56 56 0 0 0 160 112 H96 A24 24 0 0 1 96 64 H192 Z',
 'a4-optical': 'M224 32 H96 C60 32 40 52 40 88 C40 124 60 144 96 144 H160 C176 144 184 152 184 168 C184 184 176 192 160 192 H64 L32 224 H160 C196 224 216 204 216 168 C216 132 196 112 160 112 H96 C80 112 72 104 72 88 C72 72 80 64 96 64 H192 Z',
 'a5-bold': 'M224 32 H96 A57 57 0 0 0 96 146 H160 A21 21 0 0 1 160 188 H68 L32 224 H160 A57 57 0 0 0 160 110 H96 A21 21 0 0 1 96 68 H188 Z',
}

def doc(body, width=256, height=256, title='SpotiStats Replay S refinement'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title"><title id="title">{html.escape(title)}</title>{body}</svg>\n'

def embed(svg,x,y,w,h):
    clean=re.sub(r'<title.*?</title>','',svg)
    clean=re.sub(r'\s(role|aria-labelledby)="[^"]*"','',clean)
    return re.sub(r'<svg[^>]*>',lambda m: re.sub(r'\s(width|height)="[^"]*"','',m.group(0))[:-1]+f' x="{x}" y="{y}" width="{w}" height="{h}">',clean,count=1)

def write_svg(name,svg):
    (OUT/name).write_text(svg,encoding='utf-8')

for key, path in VARIANTS.items():
    write_svg(key+'-symbol.svg',doc(f'<path fill="#111111" d="{path}"/>'))

# Internal comparison: same geometry at large, 32px, and 16px sizes.
parts=['<rect width="1400" height="680" fill="#f4f4ef"/>','<text x="48" y="62" font-family="Segoe UI" font-size="30" font-weight="600">Replay / geometry study</text>']
items=[('Original',ORIGINAL)]+[(key,(OUT/(key+'-symbol.svg')).read_text()) for key in VARIANTS]
for i,(label,svg) in enumerate(items):
    x=40+i*340
    parts += [f'<rect x="{x}" y="100" width="320" height="530" rx="16" fill="white"/>',embed(svg,x+24,120,272,272),f'<text x="{x+24}" y="445" font-family="Segoe UI" font-size="22">{label}</text>',embed(svg,x+24,475,64,64),embed(svg,x+120,507,32,32),embed(svg,x+184,523,16,16)]
study=doc(''.join(parts),1400,680,'Replay geometry study')
write_svg('geometry-study.svg',study)
(OUT/'geometry-study.png').write_bytes(resvg_py.svg_to_bytes(svg_string=study))

chosen=(OUT/'a4-optical-symbol.svg').read_text()
art=f'<path fill="#111111" d="{VARIANTS["a4-optical"]}"/>'
write_svg('replay-refined-symbol.svg',chosen)
new_wordmark=WORDMARK.replace('translate(288 ','translate(224 ')
old_width=float(re.search(r'viewBox="0 0 ([\d.]+) 256"',(ROOT/'round-01/a-replay-v2-lockup.svg').read_text()).group(1))
lockup=doc(f'<g transform="translate(0 24) scale(0.8125)">{art}</g>'+new_wordmark,int(old_width-64),256,'SpotiStats Replay — refined concept lockup')
write_svg('replay-refined-lockup.svg',lockup)

# A single refinement board, not a final identity kit.
font='font-family="Segoe UI,sans-serif"'
parts=[f'<rect width="1500" height="1120" fill="#f5f5f0"/>',f'<text x="64" y="76" {font} font-size="38" font-weight="650" fill="#151915">SpotiStats / Replay, refined</text>',f'<text x="64" y="116" {font} font-size="19" fill="#626962">Matching curves. More open space. A closer relationship with the name.</text>',
 '<rect x="64" y="160" width="480" height="530" rx="18" fill="#e9ebe5"/>','<rect x="568" y="160" width="868" height="530" rx="18" fill="#fff"/>',
 f'<text x="96" y="204" {font} font-size="17" fill="#656e66">Original</text>',f'<text x="600" y="204" {font} font-size="17" font-weight="600" fill="#151915">Refined Replay S</text>',embed(ORIGINAL,168,244,272,272),embed(chosen,782,210,380,380),
 f'<text x="96" y="572" {font} font-size="17" fill="#656e66">Uneven upper and lower returns</text>',f'<text x="600" y="612" {font} font-size="17" fill="#656e66">32-unit ribbon · 48-unit counters · matching 45° cuts</text>',embed(chosen,1234,586,48,48),embed(chosen,1310,602,32,32),embed(chosen,1368,618,16,16),
 '<rect x="64" y="718" width="1372" height="284" rx="18" fill="#111812"/>',embed(lockup.replace('#111111','#f4f6f1'),112,736,1050,248),
 '<rect x="1200" y="788" width="156" height="156" rx="32" fill="#1ed760"/>',embed(chosen,1214,802,128,128),
 f'<text x="64" y="1058" {font} font-size="18" fill="#626962">Refined concept · outlined vector artwork · tested at 16, 24, and 32px</text>']
board=doc(''.join(parts),1500,1120,'SpotiStats Replay refinement comparison')
write_svg('replay-refinement.svg',board)
(OUT/'replay-refinement.png').write_bytes(resvg_py.svg_to_bytes(svg_string=board))
print('Built three geometry studies, refined symbol and lockup, and the comparison board.')
