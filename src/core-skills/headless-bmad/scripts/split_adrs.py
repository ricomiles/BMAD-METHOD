#!/usr/bin/env python3
"""
split_adrs.py — Split architect output into main architecture doc + separate ADR files
Usage: python3 scripts/split_adrs.py <output_file> <adr_dir>

The architect stage is instructed to separate ADRs with "--- ADR ---" delimiters.
This script splits on that delimiter, writes the main doc back, and creates
ADRs/<n>-<title>.md for each ADR.
"""

import sys
import os
import re

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text[:60]

def split_adrs(output_file, adr_dir):
    with open(output_file) as f:
        content = f.read()

    # Split on ADR delimiter
    parts = re.split(r'^---\s*ADR\s*---\s*$', content, flags=re.MULTILINE | re.IGNORECASE)

    if len(parts) == 1:
        print(f"No ADR separators found in {output_file} — skipping split")
        return

    # First part is the main architecture doc
    main_doc = parts[0].strip()
    with open(output_file, 'w') as f:
        f.write(main_doc)

    os.makedirs(adr_dir, exist_ok=True)

    # Remaining parts are ADRs
    for i, adr_content in enumerate(parts[1:], 1):
        adr_content = adr_content.strip()
        if not adr_content:
            continue

        # Extract title from first heading
        title_match = re.search(r'^#+ (.+)$', adr_content, re.MULTILINE)
        if title_match:
            title = title_match.group(1)
            # Remove "ADR-NNN:" prefix if already present
            title = re.sub(r'^ADR-\d+:\s*', '', title).strip()
        else:
            title = f"decision-{i}"

        filename = f"{i:03d}-{slugify(title)}.md"
        adr_path = os.path.join(adr_dir, filename)

        with open(adr_path, 'w') as f:
            f.write(adr_content)

        print(f"  ADR {i}: {filename}")

    adr_count = len(parts) - 1
    print(f"Split {adr_count} ADR(s) into {adr_dir}/")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 split_adrs.py <output_file> <adr_dir>")
        sys.exit(1)
    split_adrs(sys.argv[1], sys.argv[2])
