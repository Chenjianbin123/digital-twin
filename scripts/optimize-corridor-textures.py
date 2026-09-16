"""Losslessly re-encode embedded PNGs; preserve geometry, nodes, materials and decoded RGBA pixels."""
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "public/models/hospital-corridor/3-v-1.glb"
target = source.with_name("3-v-1-optimized.glb")
data = source.read_bytes()
json_size = struct.unpack_from("<I", data, 12)[0]
document = json.loads(data[20:20 + json_size])
bin_start = 20 + json_size + 8
binary = data[bin_start:]
replacements = {}
report = []
for index, entry in enumerate(document.get("images", [])):
    if entry.get("mimeType") != "image/png" or "bufferView" not in entry:
        continue
    view_id = entry["bufferView"]
    view = document["bufferViews"][view_id]
    offset = view.get("byteOffset", 0)
    original = binary[offset:offset + view["byteLength"]]
    image = Image.open(io.BytesIO(original)).convert("RGBA")
    encoded = io.BytesIO()
    image.save(encoded, format="WEBP", lossless=True, exact=True, method=4)
    replacement = encoded.getvalue()
    assert Image.open(io.BytesIO(replacement)).convert("RGBA").tobytes() == image.tobytes()
    if len(replacement) >= len(original):
        continue
    replacements[view_id] = replacement
    entry["mimeType"] = "image/webp"
    # EXT_texture_webp is already used by the source asset.
    for texture in document.get("textures", []):
        if texture.get("source") == index:
            del texture["source"]
            texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": index}
    report.append({"image": index, "size": image.size, "before": len(original), "after": len(replacement)})

chunks = bytearray()
for index, view in enumerate(document["bufferViews"]):
    start = view.get("byteOffset", 0)
    content = replacements.get(index, binary[start:start + view["byteLength"]])
    chunks.extend(b"\x00" * (-len(chunks) % 4))
    view["byteOffset"] = len(chunks)
    view["byteLength"] = len(content)
    chunks.extend(content)
document["buffers"][0]["byteLength"] = len(chunks)
for key in ("extensionsUsed", "extensionsRequired"):
    values = document.setdefault(key, [])
    if replacements and "EXT_texture_webp" not in values:
        values.append("EXT_texture_webp")
encoded_json = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode()
encoded_json += b" " * (-len(encoded_json) % 4)
chunks.extend(b"\x00" * (-len(chunks) % 4))
result = (struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(encoded_json) + 8 + len(chunks))
          + struct.pack("<II", len(encoded_json), 0x4E4F534A) + encoded_json
          + struct.pack("<II", len(chunks), 0x004E4942) + chunks)
if target.exists():
    if target.read_bytes() != result:
        raise RuntimeError("Refusing to replace a different optimized model")
else:
    target.write_bytes(result)
print(json.dumps({"sourceBytes": len(data), "optimizedBytes": len(result), "images": report}, ensure_ascii=False))
