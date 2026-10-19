"""Build the three first-round SVG concepts. Uses an OFL Manrope font in TEMP."""
from pathlib import Path
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import resvg_py

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'round-01'
OUT.mkdir(exist_ok=True)
FONT = Path(os.environ['TEMP']) / 'spoti-logo-fonts' / 'Manrope.ttf'
font = instantiateVariableFont(TTFont(FONT), {'wght':650})
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
units = font['head'].unitsPerEm
scale = 128 / units

ART = {
    'a-replay': '<path fill="#111111" d="M220 32 H100 A64 64 0 0 0 100 160 H164 A16 16 0 0 1 164 192 H68 L36 224 H164 A48 48 0 0 0 164 128 H100 A32 32 0 0 1 100 64 H188 Z"/>',
    'b-tasteprint': '<path fill="#111111" d="M32 224 V120 A96 96 0 0 1 224 120 V152 H192 V120 A64 64 0 0 0 64 120 V224 Z"/><path fill="#111111" d="M88 224 V128 A40 40 0 0 1 168 128 V224 H144 V128 A16 16 0 0 0 112 128 V224 Z"/><circle cx="208" cy="200" r="16" fill="#111111"/>',
    'c-saved-spot': '<path fill="#111111" d="M48 32 H208 V64 H192 A32 32 0 0 0 192 128 H208 V224 L128 184 L48 224 Z"/><circle cx="192" cy="96" r="12" fill="#111111"/>',
}
TITLES = {'a-replay':'Replay S', 'b-tasteprint':'Tasteprint', 'c-saved-spot':'Saved Spot'}

def wordmark():
    paths, x, prev = [], 0, ''
    adjustments = {'Sp':-20,'po':-5,'ot':-12,'ti':-22,'iS':10,'St':-12,'ta':-12,'at':-10,'ts':-12}
    for char in 'SpotiStats':
        x += adjustments.get(prev+char,0)
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(char)]].draw(TransformPen(pen,(1,0,0,1,x,0)))
        paths.append(pen.getCommands())
        x += font['hmtx'][cmap[ord(char)]][0]
        prev = char
    return ''.join(f'<path d="{p}" fill="#111111"/>' for p in paths), x * scale

word, word_width = wordmark()
def save_version(artwork, version):
    for key, art in artwork.items():
        symbol = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title"><title id="title">SpotiStats — {TITLES[key]} concept</title>{art}</svg>\n'
        (OUT / f'{key}-{version}-symbol.svg').write_text(symbol,encoding='utf-8')
        baseline = 128 + font['OS/2'].sCapHeight * scale / 2
        width = round(288 + word_width + 24)
        lockup = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 256" width="{width}" height="256" role="img" aria-labelledby="title"><title id="title">SpotiStats — {TITLES[key]} concept lockup</title><g id="symbol">{art}</g><g id="wordmark" transform="translate(288 {baseline:.2f}) scale({scale:.8f} {-scale:.8f})">{word}</g></svg>\n'
        (OUT / f'{key}-{version}-lockup.svg').write_text(lockup,encoding='utf-8')
        (OUT / f'{key}-{version}.png').write_bytes(resvg_py.svg_to_bytes(svg_string=symbol,width=512,height=512,background='white'))

save_version(ART,'v1')
ART_V2 = dict(ART)
ART_V2['b-tasteprint'] = ART['b-tasteprint'].replace('cy="200"','cy="208"')
ART_V2['c-saved-spot'] = '<path fill="#111111" d="M48 32 H208 V64 H192 A36 36 0 0 0 192 136 H208 V224 L128 184 L48 224 Z"/><circle cx="192" cy="100" r="16" fill="#111111"/>'
save_version(ART_V2,'v2')
print('Wrote first and refined iterations: symbols, outlined lockups, and review renders.')
