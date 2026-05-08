#!/usr/bin/env python3
"""
fetch_figma_frames.py — Fetch frame images from a Figma file via the Figma API
Usage: python3 scripts/fetch_figma_frames.py <file_key> <frame_names_csv> <output_dir>
Requires: FIGMA_TOKEN environment variable
"""

import sys
import os
import json
import urllib.request
import urllib.error

def fetch(url, token):
    req = urllib.request.Request(url, headers={"X-Figma-Token": token})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def main():
    if len(sys.argv) < 4:
        print("Usage: fetch_figma_frames.py <file_key> <frame_names_csv> <output_dir>")
        sys.exit(1)

    file_key   = sys.argv[1]
    frame_csv  = sys.argv[2]   # comma-separated frame names, or "" for all
    output_dir = sys.argv[3]
    token      = os.environ.get("FIGMA_TOKEN", "")

    if not token:
        print("FIGMA_TOKEN not set — skipping Figma frame fetch", file=sys.stderr)
        sys.exit(0)

    os.makedirs(output_dir, exist_ok=True)
    requested = set(n.strip() for n in frame_csv.split(",") if n.strip())

    # 1. Get file structure to find frame node IDs
    print(f"Fetching Figma file: {file_key}")
    try:
        file_data = fetch(f"https://api.figma.com/v1/files/{file_key}", token)
    except urllib.error.HTTPError as e:
        print(f"Figma API error: {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)

    # Walk document tree to find frames matching requested names
    frame_nodes = {}
    def walk(node):
        name = node.get("name", "")
        ntype = node.get("type", "")
        if ntype in ("FRAME", "COMPONENT", "SECTION"):
            if not requested or name in requested:
                frame_nodes[node["id"]] = name
        for child in node.get("children", []):
            walk(child)

    doc = file_data.get("document", {})
    for page in doc.get("children", []):
        for child in page.get("children", []):
            walk(child)

    if not frame_nodes:
        print(f"No matching frames found. Available top-level frames:", file=sys.stderr)
        for page in doc.get("children", []):
            for child in page.get("children", []):
                print(f"  - {child.get('name', '?')} ({child.get('type', '?')})", file=sys.stderr)
        sys.exit(0)

    # 2. Get image render URLs for found nodes
    node_ids = ",".join(frame_nodes.keys())
    img_data = fetch(
        f"https://api.figma.com/v1/images/{file_key}?ids={node_ids}&format=png&scale=2",
        token
    )
    images = img_data.get("images", {})

    # 3. Download each image
    for node_id, frame_name in frame_nodes.items():
        url = images.get(node_id)
        if not url:
            print(f"No image URL for: {frame_name}", file=sys.stderr)
            continue

        safe_name = frame_name.lower().replace(" ", "-").replace("/", "-")[:60]
        out_path = os.path.join(output_dir, f"{safe_name}.png")

        print(f"  Downloading: {frame_name} → {out_path}")
        try:
            urllib.request.urlretrieve(url, out_path)
        except Exception as e:
            print(f"  Failed to download {frame_name}: {e}", file=sys.stderr)

    print(f"Fetched {len(images)} frame(s) to {output_dir}/")

if __name__ == "__main__":
    main()
