"""Package Blender renders as comparison references.

The application uses real GLBs; these images are only offline visual references.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/hospital-navigation'
OUT.mkdir(parents=True, exist_ok=True)
floor_root = ROOT / 'output/hospital-floor-reference-v4'
with Image.open(floor_root / 'light.png') as light, Image.open(floor_root / 'dark.png') as dark:
    boxes = [image.getchannel('A').getbbox() for image in (light, dark)]
    crop = (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))
sources = {
    'exterior-v3': ROOT / 'output/hospital-exterior-reference-v3/hero.png',
    'floor-v4-light': floor_root / 'light.png',
    'floor-v4-dark': floor_root / 'dark.png',
}
assets = {}
for name, source in sources.items():
    with Image.open(source) as image:
        if name.startswith('floor'):
            image = image.crop(crop)
        image.thumbnail((2304, 1536), Image.Resampling.LANCZOS)
        target = OUT / (name + '.webp')
        image.save(target, 'WEBP', quality=90, method=6)
        assets[name] = {'source': str(source.relative_to(ROOT)),
                        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'width': image.width, 'height': image.height,
                        'bytes': target.stat().st_size}
report = {'presentation': 'Fixed-view interactive Blender renders; not real-time 3D',
          'floorCrop': crop, 'assets': assets,
          'stationAnchor': [(3840 * .519 - crop[0]) / (crop[2] - crop[0]),
                            (2560 * .399 - crop[1]) / (crop[3] - crop[1])]}
(OUT / 'reference-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
