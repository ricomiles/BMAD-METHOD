#!/usr/bin/env python3
"""
update_state.py — PIPELINE_STATE.json management
Usage:
  python3 update_state.py init <brief_path>
  python3 update_state.py start <stage>
  python3 update_state.py gate <stage> <PASS|FAIL> <score> [critique] [bc_score] [ech_score] [contested_count]
  python3 update_state.py ticket <ticket_id> <PASS|FAIL> <score> [critique] [manifest_path]
  python3 update_state.py escalate <stage>
  python3 update_state.py complete
  python3 update_state.py status
  python3 update_state.py get <json_path>   # e.g. "stages.analyst.status"
  python3 update_state.py repair_cycle reviewer
  python3 update_state.py repair_cycle ticket <ticket_id>
"""

import sys
import json
import hashlib
import os
import re
from datetime import datetime, timezone

AUTOPILOT_DIR = ".autopilot"
STATE_FILE = f"{AUTOPILOT_DIR}/PIPELINE_STATE.json"
REGISTRY_FILE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'references', 'stage-registry.yaml')
)

GREENFIELD_STAGES = ["analyst", "architect", "task-breakdown", "developer", "reviewer"]
BROWNFIELD_STAGES = ["context-ingestion", "analyst", "architect", "task-breakdown", "developer", "reviewer"]

def _load_registry_stages():
    """Parse stage-registry.yaml, return list of {id, mode} dicts. Returns None if file absent."""
    if not os.path.exists(REGISTRY_FILE):
        return None
    stages = []
    current = None
    with open(REGISTRY_FILE) as f:
        for line in f:
            m = re.match(r'^\s+-\s+id:\s+(\S+)', line)
            if m:
                if current is not None:
                    stages.append(current)
                current = {'id': m.group(1), 'mode': []}
                continue
            if current is None:
                continue
            m = re.match(r'^\s+mode:\s+\[([^\]]+)\]', line)
            if m:
                current['mode'] = [v.strip() for v in m.group(1).split(',')]
    if current is not None:
        stages.append(current)
    return stages or None

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
    registry = _load_registry_stages()
    if registry is None:
        return BROWNFIELD_STAGES if mode == "brownfield" else GREENFIELD_STAGES
    return [s['id'] for s in registry if mode in s['mode']]

def now():
    return datetime.now(timezone.utc).isoformat()

def migrate_v1_to_v2(state):
    """Add gate_consensus to stage entries missing it; bump version to 2."""
    if state.get("version") == "2":
        return state
    default_gc = {
        "blind_critic_score": None,
        "edge_case_score": None,
        "adjudicator_score": None,
        "contested_decisions_flagged": None
    }
    for stage_key, stage_data in state.get("stages", {}).items():
        if not isinstance(stage_data, dict):
            continue
        if stage_key == "developer":
            for ticket_data in stage_data.get("tickets", {}).values():
                if not isinstance(ticket_data, dict):
                    continue
                if "manifest_path" not in ticket_data:
                    ticket_data["manifest_path"] = None
                if "repair_cycles" not in ticket_data:
                    ticket_data["repair_cycles"] = 0
            continue
        if stage_key == "reviewer" and "repair_cycles" not in stage_data:
            stage_data["repair_cycles"] = 0
        if "gate_consensus" not in stage_data:
            stage_data["gate_consensus"] = dict(default_gc)
        if "critiques" not in stage_data:
            stage_data["critiques"] = []
    state["version"] = "2"
    return state

def load_state():
    with open(STATE_FILE) as f:
        state = json.load(f)
    if state.get("version") != "2":
        state = migrate_v1_to_v2(state)
        save_state(state)
    return state

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
        "gate_consensus": {
            "blind_critic_score": None,
            "edge_case_score": None,
            "adjudicator_score": None,
            "contested_decisions_flagged": None
        },
        "critiques": []
    }
    if stage == "architect":
        base["adr_dir"] = f"{AUTOPILOT_DIR}/stages/architect/ADRs/"
    if stage == "task-breakdown":
        base["ticket_count"] = None
    if stage == "reviewer":
        base["repair_cycles"] = 0
    if stage == "developer":
        base["tickets"] = {}
        del base["gate_consensus"]  # developer uses ticket-level gating
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
        "version": "2",
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

def cmd_gate(stage, verdict, score, critique="", bc_score=None, ech_score=None, contested_count=0):
    state = load_state()
    stages = get_stages(state.get("mode", "greenfield"))
    s = state["stages"][stage]
    score_int = int(score)
    bc = int(bc_score) if bc_score and bc_score != "null" else None
    ech = int(ech_score) if ech_score and ech_score != "null" else None
    contested = int(contested_count) if contested_count else 0

    if "gate_consensus" not in s:
        s["gate_consensus"] = {"blind_critic_score": None, "edge_case_score": None,
                               "adjudicator_score": None, "contested_decisions_flagged": 0}
    s["gate_consensus"]["blind_critic_score"] = bc
    s["gate_consensus"]["edge_case_score"] = ech
    s["gate_consensus"]["adjudicator_score"] = score_int
    s["gate_consensus"]["contested_decisions_flagged"] = contested

    score = score_int

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

def cmd_ticket(ticket_id, verdict, score, critique="", manifest_path=None):
    state = load_state()
    dev = state["stages"]["developer"]
    score = int(score)

    if ticket_id not in dev["tickets"]:
        dev["tickets"][ticket_id] = {
            "status": "pending",
            "attempts": 0,
            "score": None,
            "manifest_path": manifest_path,
            "repair_cycles": 0,
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

def cmd_repair_cycle(target, ticket_id=None):
    state = load_state()
    if target == "reviewer":
        if "reviewer" not in state["stages"]:
            print("ERROR: reviewer stage not found in state")
            sys.exit(1)
        s = state["stages"]["reviewer"]
        s["repair_cycles"] = s.get("repair_cycles", 0) + 1
        save_state(state)
        print(f"repair_cycles: reviewer → {s['repair_cycles']}")
    elif target == "ticket" and ticket_id:
        if "developer" not in state["stages"]:
            print("ERROR: developer stage not found in state")
            sys.exit(1)
        dev = state["stages"]["developer"]
        if ticket_id not in dev["tickets"]:
            print(f"ERROR: ticket {ticket_id} not found in developer stage state")
            sys.exit(1)
        t = dev["tickets"][ticket_id]
        t["repair_cycles"] = t.get("repair_cycles", 0) + 1
        save_state(state)
        print(f"repair_cycles: {ticket_id} → {t['repair_cycles']}")
    else:
        print(f"ERROR: usage: repair_cycle reviewer | repair_cycle ticket <ticket_id>")
        sys.exit(1)


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
        bc_score = sys.argv[6] if len(sys.argv) > 6 else None
        ech_score = sys.argv[7] if len(sys.argv) > 7 else None
        contested = sys.argv[8] if len(sys.argv) > 8 else 0
        cmd_gate(sys.argv[2], sys.argv[3], sys.argv[4], critique, bc_score, ech_score, contested)
    elif cmd == "ticket":
        critique = sys.argv[5] if len(sys.argv) > 5 else ""
        manifest_path = sys.argv[6] if len(sys.argv) > 6 else None
        cmd_ticket(sys.argv[2], sys.argv[3], sys.argv[4], critique, manifest_path)
    elif cmd == "escalate":
        cmd_escalate(sys.argv[2])
    elif cmd == "complete":
        cmd_complete()
    elif cmd == "status":
        cmd_status()
    elif cmd == "get":
        cmd_get(sys.argv[2])
    elif cmd == "repair_cycle":
        cmd_repair_cycle(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
