#!/usr/bin/env python3
"""
check_seeded.py — Check if a stage has a pre-seeded artifact in PROJECT_BRIEF.md
Usage: python3 scripts/check_seeded.py <stage_name>
Output: "<mode>|<path>" where mode is skip | refine | none

Brief format:
  ## Pre-seeded stages
  analyst:
    source: docs/PRD.md
    mode: refine
  architect:
    source: docs/ARCHITECTURE.md
    mode: skip
"""

import sys
import re
import os

def check_seeded(stage, brief_path="PROJECT_BRIEF.md"):
    if not os.path.exists(brief_path):
        print("none|")
        return

    with open(brief_path) as f:
        content = f.read()

    # Find the pre-seeded stages section
    seeded_section = extract_seeded_section(content)
    if not seeded_section:
        print("none|")
        return

    # Parse stage entry within that section
    # Handles both inline and indented formats:
    #   analyst:
    #     source: path/to/file.md
    #     mode: skip
    pattern = rf'^\s*{re.escape(stage)}:\s*\n((?:\s+\w[^\n]*\n)*)'
    m = re.search(pattern, seeded_section, re.MULTILINE)

    if not m:
        print("none|")
        return

    block = m.group(1)

    # Extract source and mode from the indented block
    source_m = re.search(r'source:\s*(.+)', block)
    mode_m = re.search(r'mode:\s*(\w+)', block)

    if not source_m:
        print("none|")
        return

    source = source_m.group(1).strip()
    mode = mode_m.group(1).strip().lower() if mode_m else "refine"

    # Validate mode value
    if mode not in ("skip", "refine"):
        sys.stderr.write(f"Warning: unknown mode '{mode}' for {stage} — defaulting to 'refine'\n")
        mode = "refine"

    # Validate source file exists
    if not os.path.exists(source):
        sys.stderr.write(f"Warning: seeded source not found: {source}\n")
        sys.stderr.write(f"  Stage {stage} will run normally (no seed).\n")
        print("none|")
        return

    print(f"{mode}|{source}")


def extract_seeded_section(content):
    """Extract the 'Pre-seeded stages' section from the brief."""
    lines = content.splitlines()
    in_section = False
    section_lines = []

    for line in lines:
        if re.match(r'^#{1,3}\s+', line):
            heading = re.sub(r'^#+\s+', '', line).lower()
            if any(kw in heading for kw in ["pre-seeded", "seeded stages", "existing artifacts", "seed"]):
                in_section = True
                section_lines = []
                continue
            elif in_section:
                break
        elif in_section:
            section_lines.append(line)

    return "\n".join(section_lines) if section_lines else None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_seeded.py <stage_name>")
        sys.exit(1)
    check_seeded(sys.argv[1])
