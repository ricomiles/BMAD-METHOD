#!/usr/bin/env python3
"""
monitor.py — Live pipeline status monitor
Usage:
  python3 scripts/monitor.py              # one-shot (good for: watch -n 2 python3 scripts/monitor.py)
  python3 scripts/monitor.py --loop       # self-refreshing loop (Ctrl-C to exit)
  python3 scripts/monitor.py --loop --interval 3
"""

import sys
import json
import os
import time
from datetime import datetime, timezone

AUTOPILOT_DIR = ".autopilot"
STATE_FILE = f"{AUTOPILOT_DIR}/PIPELINE_STATE.json"
LOG_FILE = f"{AUTOPILOT_DIR}/pipeline.log"
LOG_TAIL = 14

GREENFIELD_STAGES = ["analyst", "architect", "task-breakdown", "developer", "reviewer"]
BROWNFIELD_STAGES = ["context-ingestion", "analyst", "architect", "task-breakdown", "developer", "reviewer"]

# ANSI helpers
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"

STATUS_COLOR = {
    "passed": GREEN,
    "running": CYAN,
    "escalated": RED,
    "pending": DIM,
    "failed": RED,
}
STATUS_ICON = {
    "passed": "✓",
    "running": "⟳",
    "escalated": "⚠",
    "pending": "·",
    "failed": "✗",
}

LOG_TYPE_COLOR = {
    "pipeline": DIM,
    "stage": BOLD,
    "llm_start": CYAN,
    "llm_end": CYAN,
    "llm_heartbeat": DIM,
    "gate_start": YELLOW,
    "gate_end": "",
    "retry": MAGENTA,
}
LOG_TYPE_LABEL = {
    "pipeline": "pipeline  ",
    "stage": "stage    ",
    "llm_start": "llm ▶    ",
    "llm_end": "llm ■    ",
    "llm_heartbeat": "llm …    ",
    "gate_start": "gate ▶   ",
    "gate_end": "gate ■   ",
    "retry": "retry    ",
}


def elapsed_str(iso_ts):
    if not iso_ts:
        return "?"
    try:
        started = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
        secs = int((datetime.now(timezone.utc) - started).total_seconds())
        if secs < 0:
            return "0s"
        if secs < 60:
            return f"{secs}s"
        if secs < 3600:
            return f"{secs // 60}m{secs % 60:02d}s"
        return f"{secs // 3600}h{(secs % 3600) // 60:02d}m"
    except Exception:
        return "?"


def fmt_tokens(n):
    if n >= 1000:
        return f"{n / 1000:.1f}k"
    return str(n)


def token_bar(current, width=28):
    # Shows a relative progress bar; anchors at a soft max for visual reference
    soft_max = 200_000
    filled = min(int(width * current / soft_max), width)
    return f"[{'█' * filled}{'░' * (width - filled)}]"


def render_stages(state, col_width=80):
    mode = state.get("mode", "greenfield")
    stages = BROWNFIELD_STAGES if mode == "brownfield" else GREENFIELD_STAGES
    lines = []
    header = f" {'STAGE':<24} {'SCORE':<8} {'RETRIES':<10} {'ELAPSED'}"
    lines.append(f"{DIM}{header}{RESET}")
    lines.append(f"{DIM} {'─' * (col_width - 2)}{RESET}")

    for stage in stages:
        s = state["stages"].get(stage, {})
        status = s.get("status", "pending")
        color = STATUS_COLOR.get(status, "")
        icon = STATUS_ICON.get(status, "?")
        score_str = f"{s['score']}/10" if s.get("score") is not None else ""
        attempts = s.get("attempts", 0)
        retry_str = f"{attempts}R" if attempts else ""

        elapsed = ""
        if status == "running":
            started = s.get("started_at") or state.get("updated_at", "")
            if started:
                elapsed = f"⏱ {elapsed_str(started)}"

        dev_info = ""
        if stage == "developer" and status == "passed":
            tickets = s.get("tickets", {})
            passed_t = sum(1 for t in tickets.values() if t.get("status") == "passed")
            dev_info = f"  ({passed_t}/{len(tickets)} tickets)"

        row = f" {icon} {stage:<23} {score_str:<8} {retry_str:<10} {elapsed}{dev_info}"
        lines.append(f"{color}{row}{RESET}")

    return lines


def render_tokens(state, col_width=80):
    mode = state.get("mode", "greenfield")
    stages = BROWNFIELD_STAGES if mode == "brownfield" else GREENFIELD_STAGES
    total_in = 0
    total_out = 0
    for stage in stages:
        s = state["stages"].get(stage, {})
        total_in += s.get("tokens_in_est", 0) or 0
        total_out += s.get("tokens_out_est", 0) or 0

    if total_in == 0 and total_out == 0:
        # Try reading from log file instead
        total_in, total_out = _sum_tokens_from_log()

    lines = []
    lines.append(f" In:  {token_bar(total_in)}  ~{fmt_tokens(total_in)}")
    lines.append(f" Out: {token_bar(total_out)}  ~{fmt_tokens(total_out)}")
    return lines, total_in, total_out


def _sum_tokens_from_log():
    total_in = 0
    total_out = 0
    try:
        with open(LOG_FILE) as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    total_in += entry.get("tokens_in_est", 0) or 0
                    total_out += entry.get("tokens_out_est", 0) or 0
                except Exception:
                    pass
    except Exception:
        pass
    return total_in, total_out


def _gate_verdict_color(msg):
    if "PASS" in msg:
        return GREEN
    if "FAIL" in msg:
        return RED
    return ""


def render_log(col_width=80):
    lines = []
    try:
        with open(LOG_FILE) as f:
            raw = f.readlines()
    except FileNotFoundError:
        lines.append(f"{DIM} (no log yet — pipeline has not started){RESET}")
        return lines

    entries = []
    for line in raw:
        try:
            entries.append(json.loads(line.strip()))
        except Exception:
            pass

    tail = entries[-LOG_TAIL:]
    for entry in tail:
        ts = entry.get("ts", "")
        hm = ts[11:19] if len(ts) >= 19 else ts
        etype = entry.get("type", "")
        stage = entry.get("stage", "")
        msg = entry.get("msg", "")

        label = LOG_TYPE_LABEL.get(etype, f"{etype:<9}")
        color = LOG_TYPE_COLOR.get(etype, "")

        if etype == "gate_end":
            color = _gate_verdict_color(msg)

        stage_prefix = f"{stage} – " if stage else ""
        row = f" {DIM}{hm}{RESET}  {color}{label}{RESET}  {stage_prefix}{msg}"
        lines.append(row)

    return lines


def divider(char="═", width=80):
    return f"{DIM}{char * width}{RESET}"


def section_header(title, width=80):
    return f"{DIM} {title}{' ' * (width - len(title) - 2)}{RESET}"


def render(state, col_width=80):
    mode = state.get("mode", "greenfield")
    project = state.get("project", "unknown")
    current = state.get("current_stage", "?")
    total_retries = state.get("total_retries", 0)
    started_at = state.get("started_at", "")
    pipeline_elapsed = elapsed_str(started_at) if started_at else "?"

    now_str = datetime.now().strftime("%H:%M:%S")
    title = f" {BOLD}BMAD Autopilot — {project}{RESET} [{mode}]"
    ts_right = f"{now_str} UTC  {DIM}+{pipeline_elapsed}{RESET}"

    out = []
    out.append(divider("═", col_width))
    out.append(f"{title}   {ts_right}")
    out.append(divider("═", col_width))
    out.append("")

    # Stages
    out.append(section_header("STAGES", col_width))
    out.extend(render_stages(state, col_width))
    out.append("")

    # Token bar
    token_lines, total_in, total_out = render_tokens(state, col_width)
    if total_in > 0 or total_out > 0:
        out.append(section_header("TOKENS (estimated)", col_width))
        out.extend(token_lines)
        out.append("")

    # Current status line
    status_line = f" Current: {CYAN}{current}{RESET}   Total retries: {total_retries}"
    if state.get("total_duration_seconds"):
        status_line += f"   Completed in {state['total_duration_seconds']}s"
    out.append(status_line)

    if state.get("escalations"):
        out.append(f" {RED}⚠ {len(state['escalations'])} escalation(s) — see {AUTOPILOT_DIR}/ESCALATION.md{RESET}")

    out.append("")
    out.append(divider("═", col_width))

    # Log
    out.append(section_header(f"PIPELINE LOG  (last {LOG_TAIL} entries)", col_width))
    out.append(f"{DIM} {'─' * (col_width - 2)}{RESET}")
    out.extend(render_log(col_width))
    out.append(divider("═", col_width))

    return "\n".join(out)


def show():
    if not os.path.exists(STATE_FILE):
        print("No pipeline state found. Run the pipeline first.")
        return
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
    except Exception as e:
        print(f"Error reading state: {e}")
        return

    try:
        cols = os.get_terminal_size().columns
    except Exception:
        cols = 80
    cols = max(72, min(cols, 120))

    print(render(state, cols))


def loop(interval=2.0):
    try:
        while True:
            print("\033[2J\033[H", end="")  # clear screen, move to top
            show()
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nMonitor stopped.")


def main():
    args = sys.argv[1:]
    do_loop = "--loop" in args or "-l" in args
    interval = 2.0
    for i, a in enumerate(args):
        if a in ("--interval", "-i") and i + 1 < len(args):
            try:
                interval = float(args[i + 1])
            except ValueError:
                pass

    if do_loop:
        loop(interval)
    else:
        show()


if __name__ == "__main__":
    main()
