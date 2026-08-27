from __future__ import annotations

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "public" / "models" / "smart-ward-nurse-station" / "high_fidelity_nurse_station.blend"


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    for target in bpy.data.objects:
        name = target.name
        if not any(token in name for token in ("Door", "door", "Corridor")):
            continue
        parent = target.parent.name if target.parent else "-"
        location = tuple(round(value, 3) for value in target.location)
        world = tuple(round(value, 3) for value in target.matrix_world.translation)
        dimensions = tuple(round(value, 3) for value in target.dimensions)
        print(f"{name}|type={target.type}|parent={parent}|loc={location}|world={world}|dim={dimensions}")


if __name__ == "__main__":
    main()
