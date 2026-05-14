#!/usr/bin/env python3
"""
load_stage_plan.py — Read stage-registry.yaml and output ordered stage plan as JSON.
Usage:
  python3 load_stage_plan.py [--mode greenfield|brownfield]
Reads mode from PIPELINE_STATE.json if --mode not given.
Outputs JSON: {"stages": [...], "flags": {stage_id: {flags...}}}
"""

import sys
import os
import re
import json

AUTOPILOT_DIR = ".autopilot"
STATE_FILE = f"{AUTOPILOT_DIR}/PIPELINE_STATE.json"
REGISTRY_FILE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'references', 'stage-registry.yaml')
)


def load_registry():
    """Line-by-line parser for stage-registry.yaml. Returns list of stage dicts."""
    if not os.path.exists(REGISTRY_FILE):
        print(f"ERROR: registry not found: {REGISTRY_FILE}", file=sys.stderr)
        sys.exit(1)
    stages = []
    current = None
    with open(REGISTRY_FILE, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^\s+-\s+id:\s+(\S+)', line)
            if m:
                if current is not None:
                    stages.append(current)
                current = {
                    'id': m.group(1), 'mode': [],
                    'depends_on': [], 'brownfield_depends_on': [],
                    'max_retries': 3, 'parallelizable': False,
                    'repair_loop': False, 'repair_targets': [],
                    'repair_loop_max_cycles': 0, 'active': True,
                    'decision_engine': False,
                }
                continue
            if current is None:
                continue
            _parse_field(line, current)
    if current is not None:
        stages.append(current)
    return stages


def _parse_field(line, stage):
    """Parse a single registry field line into the stage dict."""
    patterns = [
        (r'^\s+mode:\s+\[([^\]]+)\]', lambda m: stage.update({'mode': [v.strip() for v in m.group(1).split(',')]})),
        (r'^\s+depends_on:\s+\[([^\]]*)\]', lambda m: stage.update({'depends_on': [v.strip() for v in m.group(1).split(',')] if m.group(1).strip() else []})),
        (r'^\s+brownfield_depends_on:\s+\[([^\]]*)\]', lambda m: stage.update({'brownfield_depends_on': [v.strip() for v in m.group(1).split(',')] if m.group(1).strip() else []})),
        (r'^\s+repair_targets:\s+\[([^\]]*)\]', lambda m: stage.update({'repair_targets': [v.strip() for v in m.group(1).split(',')] if m.group(1).strip() else []})),
        (r'^\s+max_retries:\s+(\d+)', lambda m: stage.update({'max_retries': int(m.group(1))})),
        (r'^\s+repair_loop_max_cycles:\s+(\d+)', lambda m: stage.update({'repair_loop_max_cycles': int(m.group(1))})),
        (r'^\s+parallelizable:\s+(true|false)', lambda m: stage.update({'parallelizable': m.group(1) == 'true'})),
        (r'^\s+repair_loop:\s+(true|false)', lambda m: stage.update({'repair_loop': m.group(1) == 'true'})),
        (r'^\s+active:\s+(true|false)', lambda m: stage.update({'active': m.group(1) == 'true'})),
        (r'^\s+decision_engine:\s+(true|false)', lambda m: stage.update({'decision_engine': m.group(1) == 'true'})),
    ]
    for pattern, handler in patterns:
        m = re.match(pattern, line)
        if m:
            handler(m)
            return


def get_mode(explicit_mode):
    if explicit_mode:
        return explicit_mode
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                state = json.load(f)
            return state.get('mode', 'greenfield')
        except json.JSONDecodeError:
            pass
    return 'greenfield'


def topological_sort(all_stages, mode):
    """
    Kahn's algorithm. Returns ordered list of active stage IDs for the given mode.

    Strategy: compute full topological order of ALL stages (to get correct relative
    order even when active=false stages appear in depends_on chains), then filter
    to only active stages preserving that relative order.
    """
    by_id = {s['id']: s for s in all_stages}
    all_ids = [s['id'] for s in all_stages]

    def effective_deps(s):
        deps = [d for d in s['depends_on'] if d in by_id]
        if mode == 'brownfield':
            deps += [d for d in s.get('brownfield_depends_on', []) if d in by_id]
        return deps

    in_degree = {sid: 0 for sid in all_ids}
    unlocks = {sid: [] for sid in all_ids}
    for s in all_stages:
        for dep in effective_deps(s):
            in_degree[s['id']] += 1
            unlocks[dep].append(s['id'])

    order_index = {sid: i for i, sid in enumerate(all_ids)}
    queue = sorted([sid for sid, deg in in_degree.items() if deg == 0], key=lambda x: order_index[x])
    ordered_all = []
    while queue:
        current = queue.pop(0)
        ordered_all.append(current)
        next_batch = []
        for unlocked in unlocks[current]:
            in_degree[unlocked] -= 1
            if in_degree[unlocked] == 0:
                next_batch.append(unlocked)
        queue = sorted(queue + next_batch, key=lambda x: order_index[x])

    if len(ordered_all) != len(all_stages):
        print("ERROR: cycle detected in stage-registry.yaml", file=sys.stderr)
        sys.exit(1)

    active = [sid for sid in ordered_all
              if mode in by_id[sid]['mode'] and by_id[sid].get('active', True)]
    return active


def build_flags(stage):
    return {
        'max_retries': stage['max_retries'],
        'parallelizable': stage['parallelizable'],
        'repair_loop': stage['repair_loop'],
        'repair_targets': stage['repair_targets'],
        'repair_loop_max_cycles': stage['repair_loop_max_cycles'],
        'decision_engine': stage.get('decision_engine', False),
    }


def main():
    explicit_mode = None
    if '--mode' in sys.argv:
        idx = sys.argv.index('--mode')
        if idx + 1 < len(sys.argv):
            explicit_mode = sys.argv[idx + 1]

    mode = get_mode(explicit_mode)
    all_stages = load_registry()
    ordered = topological_sort(all_stages, mode)
    by_id = {s['id']: s for s in all_stages}

    plan = {
        'stages': ordered,
        'flags': {sid: build_flags(by_id[sid]) for sid in ordered},
    }
    print(json.dumps(plan))


if __name__ == '__main__':
    main()
