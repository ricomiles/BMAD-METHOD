#!/usr/bin/env python3
"""
update_sprint_story.py — Update a story's status in stories/sprint-status.yaml.
Usage: python3 scripts/update_sprint_story.py <story-key> <status>
  e.g.: python3 scripts/update_sprint_story.py 1-2-user-authentication done
Exits 0 on success, 1 if the story key is not found.
"""

import re
import sys
import os

SPRINT_STATUS_FILE = "stories/sprint-status.yaml"

VALID_STATUSES = ("backlog", "ready", "in-progress", "done", "skipped", "optional")


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <story-key> <status>", file=sys.stderr)
        sys.exit(1)

    story_key = sys.argv[1]
    new_status = sys.argv[2]

    if new_status not in VALID_STATUSES:
        print(f"ERROR: invalid status '{new_status}'. Valid: {', '.join(VALID_STATUSES)}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(SPRINT_STATUS_FILE):
        print(f"ERROR: {SPRINT_STATUS_FILE} not found", file=sys.stderr)
        sys.exit(1)

    with open(SPRINT_STATUS_FILE) as f:
        lines = f.readlines()

    # Match lines like "  1-2-user-authentication: backlog"
    pattern = re.compile(r'^(\s+)(' + re.escape(story_key) + r'):\s*\S+')
    found = False
    new_lines = []
    for line in lines:
        m = pattern.match(line)
        if m:
            indent = m.group(1)
            new_lines.append(f"{indent}{story_key}: {new_status}\n")
            found = True
        else:
            new_lines.append(line)

    if not found:
        print(f"ERROR: story key '{story_key}' not found in {SPRINT_STATUS_FILE}", file=sys.stderr)
        sys.exit(1)

    with open(SPRINT_STATUS_FILE, "w") as f:
        f.writelines(new_lines)

    print(f"Updated {story_key} → {new_status}")


if __name__ == "__main__":
    main()
