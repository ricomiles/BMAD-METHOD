#!/usr/bin/env python3
"""
list_stories.py — List story keys from sprint-status.yaml by status.
Usage: python3 scripts/list_stories.py <status>
  e.g.: python3 scripts/list_stories.py backlog
Prints one story key per line. Exits 0 even if no stories match.
"""

import re
import sys
import os

SPRINT_STATUS_FILE = "stories/sprint-status.yaml"
STORY_KEY_RE = re.compile(r"^\d+-\d+-")  # matches "1-2-..." but not "epic-1" or "epic-1-retro"


def main():
    target_status = sys.argv[1] if len(sys.argv) > 1 else "backlog"

    if not os.path.exists(SPRINT_STATUS_FILE):
        sys.exit(0)

    in_dev_status = False
    with open(SPRINT_STATUS_FILE) as f:
        for line in f:
            if line.strip() == "development_status:":
                in_dev_status = True
                continue
            if not in_dev_status:
                continue
            # Stop at next top-level key (no leading spaces)
            if line and not line[0].isspace() and line.strip():
                break
            m = re.match(r"^\s+(\S+):\s*(\S+)", line)
            if m:
                key = m.group(1)
                status = m.group(2)
                if STORY_KEY_RE.match(key) and status == target_status:
                    print(key)


if __name__ == "__main__":
    main()
