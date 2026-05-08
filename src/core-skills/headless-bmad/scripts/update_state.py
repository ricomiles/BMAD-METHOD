#!/usr/bin/env python3
"""
update_state.py — PIPELINE_STATE.json management
Usage:
  python3 update_state.py init <brief_path>
  python3 update_state.py start <stage>
  python3 update_state.py gate <stage> <PASS|FAIL> <score> [critique]
  python3 update_state.py ticket <ticket_id> <PASS|FAIL> <score> [critique]
  python3 update_state.py escalate <stage>
  python3 update_state.py complete
  python3 update_state.py status
  python3 update_state.py get <json_path>   # e.g. "stages.analyst.status"
"""

import sys
import json
import hashlib
import os
from datetime import datetime, timezone

AUTOPILOT_DIR = ".autopilot"
STATE_FILE = f"{AUTOPILOT_DIR}/PIPELINE_STATE.json"

GREENFIELD_STAGES = ["analyst", "architect", "task-breakdown", "developer", "reviewer"]
BROWNFIELD_STAGES = ["context-ingestion", "analyst", "architect", "task-breakdown", "developer", "reviewer"]

def detect_mode(brief_path):
    """Read mode from brief. Defaults to greenfield."""
    try:
        with open(brief_path) as f:
            content = f.read().lower()
        if "mode: brownfield" in content or "mode:brownfield" in content:
            return "brownfield"
    except FileNotFoundError:
        pass
    return "greenfield"

def get_stages(mode):
    return BROWNFIELD_STAGES if mode == "brownfield" else GREENFIELD_STAGES

def now():
    return datetime.now(timezone.utc).isoformat()

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    os.makedirs(AUTOPILOT_DIR, exist_ok=True)
    state["updated_at"] = now()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def brief_hash(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def make_stage_entry(stage):
    base = {
        "status": "pending",
        "attempts": 0,
        "score": None,
        "passed_at": None,
        "output_path": f"{AUTOPILOT_DIR}/stages/{stage}/output.md",
        "critiques": []
    }
    if stage == "architect":
        base["adr_dir"] = f"{AUTOPILOT_DIR}/stages/architect/ADRs/"
    if stage == "task-breakdown":
        base["ticket_count"] = None
    if stage == "developer":
        base["tickets"] = {}
    return base

# ─── Commands ─────────────────────────────────────────────────────────────────

def cmd_init(brief_path):
    if not os.path.exists(brief_path):
        print(f"ERROR: Brief not found: {brief_path}")
        sys.exit(1)

    mode = detect_mode(brief_path)
    stages = get_stages(mode)

    # Extract project name from brief (first H1 heading)
    project_name = "Unknown project"
    with open(brief_path) as f:
        for line in f:
            if line.startswith("# "):
                project_name = line[2:].strip()
                break

    first_stage = stages[0]
    state = {
        "version": "1",
        "mode": mode,
        "project": project_name,
        "brief_path": brief_path,
        "brief_hash": brief_hash(brief_path),
        "started_at": now(),
        "updated_at": now(),
        "current_stage": first_stage,
        "stages": {stage: make_stage_entry(stage) for stage in stages},
        "escalations": [],
        "total_retries": 0,
        "total_duration_seconds": None
    }

    save_state(state)
    print(f"Pipeline initialized: {project_name} [{mode} mode]")
    print(f"Stage sequence: {' → '.join(stages)}")
    print(f"State file: {STATE_FILE}")

def cmd_start(stage):
    state = load_state()
    if stage not in state["stages"]:
        print(f"ERROR: Unknown stage: {stage}")
        sys.exit(1)
    state["stages"][stage]["status"] = "running"
    state["current_stage"] = stage
    save_state(state)

def cmd_gate(stage, verdict, score, critique=""):
    state = load_state()
    stages = get_stages(state.get("mode", "greenfield"))
    s = state["stages"][stage]
    score = int(score)

    if verdict == "PASS":
        s["status"] = "passed"
        s["score"] = score
        s["passed_at"] = now()
        # Advance current_stage
        idx = stages.index(stage)
        if idx + 1 < len(stages):
            state["current_stage"] = stages[idx + 1]
        else:
            state["current_stage"] = "complete"
    else:
        s["status"] = "pending"
        s["attempts"] = s.get("attempts", 0) + 1
        state["total_retries"] = state.get("total_retries", 0) + 1
        if critique:
            s["critiques"].append(critique)

    save_state(state)
    print(f"Gate recorded: {stage} → {verdict} (score {score})")

def cmd_escalate(stage):
    state = load_state()
    s = state["stages"][stage]
    s["status"] = "escalated"
    state["current_stage"] = "escalated"
    state["escalations"].append({
        "stage": stage,
        "ticket": None,
        "attempt": s.get("attempts", 0),
        "timestamp": now(),
        "critique_history": s.get("critiques", []),
        "escalation_path": f"{AUTOPILOT_DIR}/ESCALATION.md"
    })
    save_state(state)
    print(f"Stage {stage} escalated.")

def cmd_ticket(ticket_id, verdict, score, critique=""):
    state = load_state()
    dev = state["stages"]["developer"]
    score = int(score)

    if ticket_id not in dev["tickets"]:
        dev["tickets"][ticket_id] = {
            "status": "pending",
            "attempts": 0,
            "score": None,
            "critiques": []
        }

    t = dev["tickets"][ticket_id]

    if verdict == "PASS":
        t["status"] = "passed"
        t["score"] = score
    else:
        t["status"] = "pending"
        t["attempts"] = t.get("attempts", 0) + 1
        state["total_retries"] = state.get("total_retries", 0) + 1
        if critique:
            t["critiques"].append(critique)

    save_state(state)

def cmd_complete():
    state = load_state()
    state["current_stage"] = "complete"
    started = datetime.fromisoformat(state["started_at"])
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    state["total_duration_seconds"] = int(elapsed)
    save_state(state)
    print(f"Pipeline complete in {int(elapsed)}s")

def cmd_status():
    if not os.path.exists(STATE_FILE):
        print("No pipeline state found.")
        return

    state = load_state()
    mode = state.get("mode", "greenfield")
    stages = get_stages(mode)

    print(f"\nBMAD Autopilot — {state.get('project', 'unknown')} [{mode}]")
    print(f"Started: {state.get('started_at', '?')[:16].replace('T', ' ')} UTC\n")

    STATUS_ICON = {
        "passed": "✓",
        "running": "⟳",
        "escalated": "⚠",
        "pending": "·",
        "failed": "✗"
    }

    for stage in stages:
        s = state["stages"].get(stage, {})
        status = s.get("status", "pending")
        icon = STATUS_ICON.get(status, "?")
        score = f"score {s['score']}/10  " if s.get("score") else "              "
        attempts = s.get("attempts", 0)
        retry_str = f"{attempts} {'retry' if attempts == 1 else 'retries'}" if attempts else "0 retries"

        if stage == "developer" and status == "passed":
            tickets = s.get("tickets", {})
            passed = sum(1 for t in tickets.values() if t.get("status") == "passed")
            print(f"  {icon} {stage:<22} {score}  {retry_str}    ({passed}/{len(tickets)} tickets)")
        else:
            print(f"  {icon} {stage:<22} {score}  {retry_str}")

    current = state.get("current_stage", "?")
    total_retries = state.get("total_retries", 0)
    duration = state.get("total_duration_seconds")
    dur_str = f"  {duration}s total" if duration else ""

    print(f"\nCurrent stage: {current}   Total retries: {total_retries}{dur_str}\n")

    if state.get("escalations"):
        print(f"⚠ {len(state['escalations'])} escalation(s) — see {AUTOPILOT_DIR}/ESCALATION.md\n")

def cmd_get(json_path):
    if not os.path.exists(STATE_FILE):
        print("pending")
        return
    state = load_state()
    parts = json_path.split(".")
    val = state
    for part in parts:
        if isinstance(val, dict):
            val = val.get(part)
        else:
            val = None
            break
    print(val if val is not None else "pending")

# ─── Dispatch ─────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "init":
        cmd_init(sys.argv[2])
    elif cmd == "start":
        cmd_start(sys.argv[2])
    elif cmd == "gate":
        critique = sys.argv[5] if len(sys.argv) > 5 else ""
        cmd_gate(sys.argv[2], sys.argv[3], sys.argv[4], critique)
    elif cmd == "ticket":
        critique = sys.argv[5] if len(sys.argv) > 5 else ""
        cmd_ticket(sys.argv[2], sys.argv[3], sys.argv[4], critique)
    elif cmd == "escalate":
        cmd_escalate(sys.argv[2])
    elif cmd == "complete":
        cmd_complete()
    elif cmd == "status":
        cmd_status()
    elif cmd == "get":
        cmd_get(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
