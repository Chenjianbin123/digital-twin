# Nurse Station Content Visibility Design

## Goal

Remove physical occlusion from the nurse-station information hierarchy while keeping the current close PC framing.

## Approved Layout

- Move all three rear information-board groups down by `0.22m` as complete units, including frames, screens, titles, rows, bars, and status indicators.
- Move the left and right rear board groups outward by `0.18m`; keep the main board centered.
- Move `Clock_Display` to a dedicated upper-right header mount that does not cover the right quiet-zone sign.
- Move the left and right small wayfinding signs down equally and keep them symmetric.
- Keep the current camera target and station scale.

## Constraints

- Preserve all interface-driven screen mappings and the live clock renderer.
- Do not shrink text to solve occlusion.
- Do not add representative patient, warning, or bed data.
- Do not change doors, corridor width, ward models, or bed-template parsing.

## Verification

- Boundary tests assert group offsets, clock mount, symmetric small-sign offset, and unchanged screen mappings.
- Blender source and exported GLB contracts verify the final object positions.
- All nurse-station tests and the production build pass.

