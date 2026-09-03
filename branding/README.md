# HotelPMS brand assets

The mark: a door opening into a **K** — hotelpms means *room*.

## Palette

| Token | Hex | Use |
|---|---|---|
| HotelPMS Green | `#1E7B4F` | mark, accents, PMS tag |
| Mint | `#56C589` | the door dot |
| Ink | `#1C3F38` | wordmark |

## Files

- `hotelpms-mark.svg` — square icon (favicons, app icons, avatars)
- `hotelpms-square.svg` — stacked lockup (social profiles, print)
- `hotelpms-horizontal.svg` — mark + wordmark (site headers, docs, decks)
- `png/` — rendered exports (mark 512/1024, square 1024, horizontal
  1560×480, favicon-32, apple-touch-180)
- `source/hotelpms-pms-original.png` — original raster reference

## Notes

- Wordmark font: geometric sans (Poppins SemiBold preferred; lockup SVGs
  fall back to Avenir Next/Montserrat). Before print/press use, convert
  the text to outlines in the SVGs.
- Regenerate PNGs: see `render-logos.mjs` pattern (sharp) — render from
  the SVGs at 300dpi density.
- Clear space: keep at least the dot's diameter around the mark.
