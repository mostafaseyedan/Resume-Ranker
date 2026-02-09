"""Simple test for _remove_background on Picture1.png and Picture2.png"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from services.badge_service import BadgeService

# We only need _remove_background, but it's an instance method,
# so we instantiate with a dummy key check bypassed
os.environ.setdefault("GEMINI_API_KEY", "dummy")
service = BadgeService()

input_dir = os.path.dirname(__file__)
output_dir = input_dir

for filename in ["Picture1.png", "Picture2.png"]:
    input_path = os.path.join(input_dir, filename)
    if not os.path.exists(input_path):
        print(f"  ✗ {filename} not found, skipping")
        continue

    img = Image.open(input_path).convert("RGBA")
    print(f"Processing {filename} ({img.size[0]}x{img.size[1]})...")

    result = service._remove_background(img)

    output_path = os.path.join(output_dir, f"nobg_{filename}")
    result.save(output_path, format="PNG")
    print(f"  ✓ Saved to {output_path}")

print("\nDone!")
