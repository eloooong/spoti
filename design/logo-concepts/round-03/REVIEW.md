# Tasteprint S refinement

Request: use the second original concept, Tasteprint, with an S signature.

## Direction

Retain the original outer arch and detached dot. Replace the nested inner arch
with a custom rounded S. The recommendation is `tasteprint-s-v2-symbol.svg`.
This keeps more of the selected concept's silhouette than the double-S track
explorations in `signature-study.png`.

## Refinement and verification

- First pass: compared the original with parallel S tracks, staggered S tracks,
  and an S contained by the original outer arch. Rendered and inspected all three.
- Second pass: enlarged the contained S, balanced its upper and lower returns,
  opened its counters, and rounded both terminals. The S uses a 20-unit band,
  33-unit outside radii and 13-unit inside radii on a 256-unit canvas.
- Rendered and inspected the revised artwork at 64, 32, 24 and 16 pixels in
  black and reversed white. At 16 pixels, the silhouette and dot remain clear;
  the inset S is necessarily a secondary detail. Prefer at least 24 pixels when
  recognition of the S itself is important.
- SVG audit: symbol 99/100; lockup 98/100. Informational findings concern the
  original arch's optical vertical offset and the outlined wordmark's point
  count/transform precision. No live text, raster artwork, strokes or filters
  in either logo master.
- Existing outlined Manrope wordmark retained; its OFL licence is in the parent
  concept directory. Captions on review boards use live text, separate from
  the logo artwork.

`tasteprint-s-refinement.png` is the concept presentation. `refinement-tests.png`
records the first and second inner-S drawings and reversed size ladder.

Angel approved this revision for the website, favicon and GitHub branding.
`../publish_brand.py` generates the production assets from the v2 masters.
