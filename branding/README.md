# HotelPMS brand assets

The mark is a **hospitality gateway**: a welcoming hotel portal containing a
precise **H**, with a small central guest door and a curved arrival line. The
navy tile keeps the identity legible on both light and dark product surfaces.

## Palette

| Token | Hex | Use |
|---|---|---|
| HotelPMS Navy | `#061F45` | mark tile, premium product chrome |
| Deep Navy | `#082B5C` | wordmark and interface identity |
| Champagne Gold | `#C9A24B` | portal, hospitality accent |
| Wordmark Gold | `#B8892E` | `PMS` in the wordmark |
| Warm Ivory | `#FFFAF0` | the H inside the gateway |

## Files

- `hotelpms-mark.svg` — square icon (favicons, app icons, avatars)
- `hotelpms-square.svg` — stacked lockup (social profiles, print)
- `hotelpms-horizontal.svg` — mark + wordmark (site headers, docs, decks)
- `png/` — rendered exports (mark 512/1024, square 1024, horizontal
  1560×480, favicon-32, apple-touch-180)
- `source/hotelpms-pms-original.png` — original raster reference

## Notes

- Wordmark font: **Manrope SemiBold** (bundled in the web app; lockup SVGs
  fall back to Avenir Next/Arial). Before print/press use, convert
  the text to outlines in the SVGs.
- Regenerate PNGs: see `render-logos.mjs` pattern (sharp) — render from
  the SVGs at 300dpi density.
- Clear space: keep at least the dot's diameter around the mark.
