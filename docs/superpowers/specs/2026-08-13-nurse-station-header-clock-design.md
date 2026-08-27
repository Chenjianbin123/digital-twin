# Nurse Station Header And Clock Design

## Goal

Improve the nurse-station header for PC display while preserving the live clock and existing data-driven screens.

## Approved Presentation

- Keep `普通外科护理单元` as the primary title and preserve its natural proportions.
- Increase the English subtitle size and spacing so it remains readable at the default camera distance.
- Keep the live clock, enlarge its digits by about 35%, enlarge its physical screen, and align it with the header baseline so it no longer appears detached.
- Move the default camera target downward from `Y=1.52` to about `Y=1.32`, showing more of the nurse counter and floor while moving the header toward the top edge.
- Keep both ward direction signs visible.

## Constraints

- Do not bake clock values or business data into the model.
- Keep `Clock_Display` mapped to the existing live clock texture.
- Keep `Screen_Work_01` through `Screen_Work_04` mapped to interface-derived JSON data.
- Do not apply non-uniform scaling to the model or text.
- Do not change ward bed-template parsing, patient-count bed creation, or ward model reuse.

## Verification

- Boundary tests must assert the new camera target, header text sizes, clock mesh dimensions, and live clock mapping.
- Blender source and exported GLB validators must pass.
- All nurse-station tests and the production build must pass.

