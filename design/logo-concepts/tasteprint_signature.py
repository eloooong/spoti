"""Explore a Tasteprint-based S signature using filled, rounded vector tracks."""
from pathlib import Path
import re
import html
import resvg_py

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'round-03'
OUT.mkdir(exist_ok=True)
original=(ROOT/'round-01/b-tasteprint-v2-symbol.svg').read_text(encoding='utf-8')

def track(top_radius,bottom_radius,width=14,start=194,end=50):
    # Two opposite semicircles; explicitly outlined round caps, no SVG stroke.
    x1,x2,y1,y2,r=90,154,88,168,width/2
    ytop=y1-top_radius
    ybottom=y2+bottom_radius
    return (f'M{start} {ytop-r} H{x1} A{top_radius+r} {top_radius+r} 0 0 0 {x1} {y1+top_radius+r} '
      f'H{x2} A{bottom_radius-r} {bottom_radius-r} 0 0 1 {x2} {ybottom-r} H{end} '
      f'A{r} {r} 0 0 0 {end} {ybottom+r} H{x2} '
      f'A{bottom_radius+r} {bottom_radius+r} 0 0 0 {x2} {y2-bottom_radius-r} H{x1} '
      f'A{top_radius-r} {top_radius-r} 0 0 1 {x1} {ytop+r} H{start} '
      f'A{r} {r} 0 0 0 {start} {ytop-r} Z')

def paths(stagger=False,width=14,dot=10):
    return (f'<path fill="#111111" d="{track(54,26,width)}"/>'
      f'<path fill="#111111" d="{track(26,54,width,start=174 if stagger else 194,end=70 if stagger else 50)}"/>'
      f'<circle cx="218" cy="220" r="{dot}" fill="#111111"/>')

signed_print='<path fill="#111111" d="M32 224 V120 A96 96 0 0 1 224 120 V152 H192 V120 A64 64 0 0 0 64 120 V224 Z"/><path fill="#111111" d="M160 88 H120 A32 32 0 0 0 120 152 H136 A8 8 0 0 1 136 168 H96 V192 H136 A32 32 0 0 0 136 128 H120 A8 8 0 0 1 120 112 H160 Z"/><circle cx="208" cy="208" r="16" fill="#111111"/>'

def doc(body,w=256,h=256,title='SpotiStats — Tasteprint S signature'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title"><title id="title">{html.escape(title)}</title>{body}</svg>\n'

def embed(svg,x,y,w,h):
    svg=re.sub(r'<title.*?</title>','',svg)
    svg=re.sub(r'\s(role|aria-labelledby)="[^"]*"','',svg)
    return re.sub(r'<svg[^>]*>',lambda m: re.sub(r'\s(width|height)="[^"]*"','',m.group(0))[:-1]+f' x="{x}" y="{y}" width="{w}" height="{h}">',svg,count=1)

variants={'signature-tracks-v1':paths(),'staggered-tracks-v1':paths(True),'signed-print-v1':signed_print}
for name,body in variants.items():
    (OUT/(name+'.svg')).write_text(doc(body),encoding='utf-8')
parts=['<rect width="1400" height="650" fill="#f4f4ef"/>','<text x="48" y="62" font-family="Segoe UI" font-size="30">Tasteprint / S signature study</text>']
for i,(label,svg) in enumerate([('Original Tasteprint',original)]+[(name,doc(body)) for name,body in variants.items()]):
    x=40+i*340
    parts += [f'<rect x="{x}" y="100" width="320" height="500" rx="16" fill="white"/>',embed(svg,x+24,120,272,272),f'<text x="{x+24}" y="440" font-family="Segoe UI" font-size="20">{label}</text>',embed(svg,x+24,475,64,64),embed(svg,x+120,507,32,32),embed(svg,x+184,523,16,16)]
study=doc(''.join(parts),1400,650)
(OUT/'signature-study.svg').write_text(study,encoding='utf-8')
(OUT/'signature-study.png').write_bytes(resvg_py.svg_to_bytes(svg_string=study))
print('Built three S-signature explorations based on Tasteprint.')

# Second refinement: retain Tasteprint's silhouette and dot; open and round the S.
outer='<path fill="#111111" d="M32 224 V120 A96 96 0 0 1 224 120 V152 H192 V120 A64 64 0 0 0 64 120 V224 Z"/>'
signature='<path fill="#111111" d="M160 88 H116 A33 33 0 0 0 116 154 H140 A13 13 0 0 1 140 180 H104 A10 10 0 0 0 104 200 H140 A33 33 0 0 0 140 134 H116 A13 13 0 0 1 116 108 H160 A10 10 0 0 0 160 88 Z"/>'
chosen=doc(outer+signature+'<circle cx="208" cy="208" r="16" fill="#111111"/>')
(OUT/'tasteprint-s-v2-symbol.svg').write_text(chosen,encoding='utf-8')
wordmark=re.search(r'<g id="wordmark".*?</g>',(ROOT/'round-02/replay-refined-lockup.svg').read_text(encoding='utf-8')).group(0)
lockup=doc('<g transform="translate(0 24) scale(0.8125)">'+outer+signature+'<circle cx="208" cy="208" r="16" fill="#111111"/></g>'+wordmark,907,256)
(OUT/'tasteprint-s-v2-lockup.svg').write_text(lockup,encoding='utf-8')
font='font-family="Segoe UI,sans-serif"'
parts=['<rect width="1400" height="1000" fill="#f4f4ef"/>',
 f'<text x="56" y="72" {font} font-size="36" font-weight="650" fill="#151915">SpotiStats / Tasteprint S</text>',
 f'<text x="56" y="112" {font} font-size="19" fill="#626962">The second concept, with a personal S signature.</text>',
 '<rect x="56" y="152" width="450" height="500" rx="18" fill="#e8ebe4"/>',
 '<rect x="530" y="152" width="814" height="500" rx="18" fill="white"/>',
 f'<text x="88" y="198" {font} font-size="17" fill="#626962">Original Tasteprint</text>',
 f'<text x="562" y="198" {font} font-size="17" font-weight="600" fill="#151915">Tasteprint + S signature</text>',
 embed(original,133,230,296,296),embed(chosen,752,216,348,348),
 f'<text x="88" y="604" {font} font-size="17" fill="#626962">Nested tracks and a signature dot</text>',
 f'<text x="562" y="604" {font} font-size="17" fill="#626962">Same outer silhouette. A clear, rounded S inside.</text>',
 '<rect x="56" y="676" width="1288" height="240" rx="18" fill="#111812"/>',
 embed(lockup.replace('#111111','#f3f5f3'),96,680,850,232),
 '<rect x="1120" y="726" width="140" height="140" rx="30" fill="#1ed760"/>',embed(chosen,1130,736,120,120),
 f'<text x="56" y="963" {font} font-size="17" fill="#626962">Concept preview · one-colour vector artwork · existing SpotiStats typography</text>']
board=doc(''.join(parts),1400,1000)
(OUT/'tasteprint-s-refinement.svg').write_text(board,encoding='utf-8')
(OUT/'tasteprint-s-refinement.png').write_bytes(resvg_py.svg_to_bytes(svg_string=board))

parts=['<rect width="1200" height="640" fill="#f4f4ef"/>']
for i,(name,svg) in enumerate([('First S study',doc(signed_print)),('Refined S',chosen),('Reversed',chosen.replace('#111111','#ffffff'))]):
    x=24+i*392
    dark=i==2
    parts += [f'<rect x="{x}" y="24" width="368" height="592" fill="{"#111812" if dark else "white"}"/>',f'<text x="{x+20}" y="60" {font} font-size="20" fill="{"white" if dark else "#111111"}">{name}</text>',embed(svg,x+56,80,256,256)]
    for j,size in enumerate([64,32,24,16]):
        parts.append(embed(svg,x+28+j*86,430+64-size,size,size))
test=doc(''.join(parts),1200,640)
(OUT/'refinement-tests.svg').write_text(test,encoding='utf-8')
(OUT/'refinement-tests.png').write_bytes(resvg_py.svg_to_bytes(svg_string=test))
print('Built refined Tasteprint S, outlined lockup, comparison and size tests.')
