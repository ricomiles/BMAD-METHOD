#!/usr/bin/env python3
"""
assemble.py — Collect stage outputs into .autopilot/DELIVERABLES/
Called after all stages pass.
"""

import sys
import os
import shutil
import json
from datetime import datetime, timezone

AUTOPILOT_DIR = ".autopilot"
STATE_FILE = f"{AUTOPILOT_DIR}/PIPELINE_STATE.json"
DELIVERABLES_DIR = f"{AUTOPILOT_DIR}/DELIVERABLES"

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def copy_if_exists(src, dst):
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
        return True
    return False

def main():
    state = load_state()
    os.makedirs(DELIVERABLES_DIR, exist_ok=True)

    print("Assembling deliverables...")

    # PRD from analyst
    copy_if_exists(
        f"{AUTOPILOT_DIR}/stages/analyst/output.md",
        f"{DELIVERABLES_DIR}/PRD.md"
    )
    print("  ✓ PRD.md")

    # Architecture from architect
    copy_if_exists(
        f"{AUTOPILOT_DIR}/stages/architect/output.md",
        f"{DELIVERABLES_DIR}/ARCHITECTURE.md"
    )
    print("  ✓ ARCHITECTURE.md")

    adr_dir = f"{AUTOPILOT_DIR}/stages/architect/ADRs"
    if os.path.isdir(adr_dir):
        copy_if_exists(adr_dir, f"{DELIVERABLES_DIR}/ADRs")
        adr_count = len(os.listdir(adr_dir))
        print(f"  ✓ ADRs/ ({adr_count} files)")

    # Task list from task-breakdown
    copy_if_exists(
        f"{AUTOPILOT_DIR}/stages/task-breakdown/output.md",
        f"{DELIVERABLES_DIR}/TASKS.md"
    )
    print("  ✓ TASKS.md")

    # Review report from reviewer
    copy_if_exists(
        f"{AUTOPILOT_DIR}/stages/reviewer/output.md",
        f"{DELIVERABLES_DIR}/REVIEW_REPORT.md"
    )
    print("  ✓ REVIEW_REPORT.md")

    # Pipeline report
    write_pipeline_report(state)
    print("  ✓ PIPELINE_REPORT.md")

    print(f"\nDeliverables ready in {DELIVERABLES_DIR}/")

def write_pipeline_report(state):
    lines = [
        f"# Pipeline Report: {state.get('project', 'Unknown')}",
        "",
        f"Run started: {state.get('started_at', '?')}",
        f"Completed: {state.get('updated_at', '?')}",
        f"Total retries: {state.get('total_retries', 0)}",
        "",
        "## Stage summary",
        "",
        "| Stage | Status | Score | Retries |",
        "|-------|--------|-------|---------|",
    ]

    for stage, s in state.get("stages", {}).items():
        status = s.get("status", "?")
        score = f"{s.get('score', '?')}/10" if s.get("score") else "—"
        attempts = s.get("attempts", 0)
        lines.append(f"| {stage} | {status} | {score} | {attempts} |")

    escalations = state.get("escalations", [])
    if escalations:
        lines += ["", "## Escalations", ""]
        for esc in escalations:
            lines.append(f"- **{esc['stage']}**: {esc.get('attempt', '?')} attempts, "
                         f"escalated at {esc.get('timestamp', '?')[:16]}")

    lines += [
        "",
        "## Files produced",
        "",
        "- `PRD.md` — Product requirements document (analyst)",
        "- `ARCHITECTURE.md` — System design (architect)",
        "- `ADRs/` — Architecture decision records (architect)",
        "- `TASKS.md` — Implementation task list (task-breakdown)",
        "- `REVIEW_REPORT.md` — Final QA review (reviewer)",
    ]

    report_path = f"{DELIVERABLES_DIR}/PIPELINE_REPORT.md"
    with open(report_path, "w") as f:
        f.write("\n".join(lines) + "\n")

if __name__ == "__main__":
    main()
