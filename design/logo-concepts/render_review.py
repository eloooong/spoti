"""Run the skill's SVG overview renderer through resvg (no browser process)."""
import runpy
import sys
from pathlib import Path
import resvg_py

script = Path(sys.argv[1]).resolve()
sys.path.insert(0,str(script.parent))
import render_png

def render(svg_file, png_file, width, height):
    Path(png_file).write_bytes(resvg_py.svg_to_bytes(svg_path=str(svg_file),width=width,height=height))
    return 'resvg'

render_png.render = render
sys.argv = sys.argv[1:]
runpy.run_path(str(script),run_name='__main__')
