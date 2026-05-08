#!/usr/bin/env python3
"""
generate_sprint_status.py — Generate stories/sprint-status.yaml from docs/epics.md
Usage: python3 scripts/generate_sprint_status.py
Reads BMAD-v6 epics format, writes sprint-status.yaml without downgrading existing statuses.
"""

import re
import os
import sys
from datetime import datetime

EPICS_FILE = "docs/epics.md"
SPRINT_STATUS_FILE = "stories/sprint-status.yaml"

STATUS_ORDER = ["backlog", "optional", "ready-for-dev", "in-progress", "review", "done"]


def slug(title: str) -> str:
    title = re.sub(r"[^a-zA-Z0-9\s-]", "", title).lower().strip()
    return re.sub(r"[\s-]+", "-", title)


def higher_status(a: str, b: str) -> str:
    ai = STATUS_ORDER.index(a) if a in STATUS_ORDER else 0
    bi = STATUS_ORDER.index(b) if b in STATUS_ORDER else 0
    return a if ai >= bi else b


def parse_epics(content: str):
    """Return list of (type, epic_num, story_num, title) tuples in document order."""
    items = []
    epic_re = re.compile(r"^## Epic (\d+):\s*(.+)$", re.MULTILINE)
    story_re = re.compile(r"^### Story (\d+)\.(\d+):\s*(.+)$", re.MULTILINE)

    epic_positions = list(epic_re.finditer(content))
    for idx, em in enumerate(epic_positions):
        epic_num = int(em.group(1))
        epic_title = em.group(2).strip()
        items.append(("epic", epic_num, None, epic_title))

        epic_start = em.end()
        epic_end = epic_positions[idx + 1].start() if idx + 1 < len(epic_positions) else len(content)
        epic_body = content[epic_start:epic_end]

        for sm in story_re.finditer(epic_body):
            s_epic = int(sm.group(1))
            s_num = int(sm.group(2))
            s_title = sm.group(3).strip()
            if s_epic == epic_num:
                items.append(("story", epic_num, s_num, s_title))

        items.append(("retro", epic_num, None, None))

    return items


def item_key(item_type, epic_num, story_num, title) -> str:
    if item_type == "epic":
        return f"epic-{epic_num}"
    if item_type == "story":
        return f"{epic_num}-{story_num}-{slug(title)}"
    return f"epic-{epic_num}-retrospective"


def load_existing_status() -> dict:
    if not os.path.exists(SPRINT_STATUS_FILE):
        return {}
    existing = {}
    with open(SPRINT_STATUS_FILE) as f:
        for line in f:
            m = re.match(r"^\s+(\S+):\s*(\S+)", line)
            if m:
                existing[m.group(1)] = m.group(2)
    return existing


def main():
    if not os.path.exists(EPICS_FILE):
        print(f"ERROR: {EPICS_FILE} not found. Run task-breakdown stage first.")
        sys.exit(1)

    with open(EPICS_FILE) as f:
        content = f.read()

    items = parse_epics(content)
    if not items:
        print("No epics/stories found in epics.md — check format.")
        sys.exit(1)

    existing = load_existing_status()
    defaults = {"epic": "backlog", "story": "backlog", "retro": "optional"}

    today = datetime.now().strftime("%Y-%m-%d")
    os.makedirs(os.path.dirname(SPRINT_STATUS_FILE), exist_ok=True)

    lines = [
        f"# generated: {today}",
        f"# last_updated: {today}",
        "#",
        "# STATUS DEFINITIONS:",
        "# Epic:  backlog → in-progress → done",
        "# Story: backlog → ready-for-dev → in-progress → review → done",
        "# Retrospective: optional → done",
        "#",
        f"generated: {today}",
        f"last_updated: {today}",
        "story_location: stories",
        "",
        "development_status:",
    ]

    story_count = epic_count = 0
    for item_type, epic_num, story_num, title in items:
        key = item_key(item_type, epic_num, story_num, title)
        default = defaults[item_type]
        current = existing.get(key, default)
        status = higher_status(current, default)
        lines.append(f"  {key}: {status}")
        if item_type == "epic":
            epic_count += 1
        elif item_type == "story":
            story_count += 1

    with open(SPRINT_STATUS_FILE, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Sprint status written: {SPRINT_STATUS_FILE}")
    print(f"  {epic_count} epics, {story_count} stories")


if __name__ == "__main__":
    main()
