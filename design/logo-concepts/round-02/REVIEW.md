# Replay S — refinement

Recommended refinement: `replay-refined-symbol.svg` and `replay-refined-lockup.svg`. See `replay-refinement.png` for the before/after comparison and dark UI color hint.

## What changed

- Matching upper and lower return geometry replaces the original 64/48-unit outer radii. The refined shape uses matching 56-unit extents, with eased cubic transitions.
- Both counters now have 48 units of vertical clearance; the original lower counter had 32. The 32-unit ribbon and opposing 45-degree terminals remain.
- The silhouette is rotationally balanced and centered. Raster-weighted center at 256px moved from approximately (123.06,131.10) to (128.04,127.96).
- In the horizontal lockup, the symbol is 18.75% smaller, and the visible gap to the lettering is reduced from about 68 to 42 units. The outlined Manrope lettering is retained.

## Review

Compared the original with circular, optical, and heavier studies at large, 64px, 32px, and 16px sizes. Selected the optical study: fuller transitions retain more character than a plain circular S without the heavier version's tighter counters.

Rendered the selected symbol at 16, 24, and 32px and inspected the generated HTML test sheet in the browser, including the pixel test, monochrome/reversed treatments, and green/dark background contexts. The black symbol on green is the color hint; white on that bright green is not recommended because of its low contrast.

The skill audit reports 100/100 for the symbol, with no issues; the outlined lockup reports 98/100 with informational notes about type-outline complexity and coordinate precision. These heuristic checks do not provide trademark clearance.

This remains a refined concept for selection. A final identity kit and installation in the website are outside this round.
