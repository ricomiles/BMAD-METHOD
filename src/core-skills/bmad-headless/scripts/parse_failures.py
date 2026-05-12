#!/usr/bin/env python3
"""
parse_failures.py — Parse reviewer output to map test failures to originating tickets.
Usage:
  python3 scripts/parse_failures.py [--reviewer-output <path>] [--manifest-dir <path>]

Output: JSON to stdout mapping ticket IDs to their failures.
  {"TASK-NNN": {"failures": [{"file": "...", "line": N, "message": "..."}]}, "unknown": {...}}

Exit 0 on success (even if no failures found — outputs {}).
Exit 1 on file read error or JSON parse error.
"""

import sys
import os
import json
import re
import argparse

MANIFEST_DIR_DEFAULT = ".autopilot/stages/task-breakdown/manifests"
REVIEWER_OUTPUT_DEFAULT = ".autopilot/stages/reviewer/output.md"

# file.ext:line[:col] followed by optional separator and message
# Handles: src/foo.ts:45 - Error, src/foo.ts:45:12 Error, tests/foo.py:45
FILE_LINE_RE = re.compile(
    r'([\w./\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py)):(\d+)(?::\d+)?(?:\s*[-–:]\s*|\s+)([^\n]*)',
    re.MULTILINE
)

# pytest FAILED line: FAILED tests/foo.py::TestClass::test_name - AssertionError: ...
PYTEST_FAILED_RE = re.compile(
    r'^FAILED\s+([\w./\-]+\.py)::[\w:]+\s+-\s+(.+)',
    re.MULTILINE
)


def parse_failures(text):
    failures = []
    seen = set()
    seen_files = set()  # files already captured by FILE_LINE_RE (to avoid PYTEST_FAILED_RE duplicates)
    for m in FILE_LINE_RE.finditer(text):
        if '://' in m.group(1):
            continue  # skip URL false positives (e.g. https://example.com/foo.ts:80)
        key = (m.group(1), m.group(2))
        if key in seen:
            continue
        seen.add(key)
        msg = m.group(3).strip()
        if not msg or msg.startswith('at ') or msg.startswith('//'):
            continue  # skip stack trace noise and comments
        seen_files.add(m.group(1))
        failures.append({'file': m.group(1), 'line': int(m.group(2)), 'message': msg})
    for m in PYTEST_FAILED_RE.finditer(text):
        if m.group(1) in seen_files:
            continue  # already captured with line-level detail from FILE_LINE_RE
        key = (m.group(1), None)
        if key in seen:
            continue
        seen.add(key)
        seen_files.add(m.group(1))
        failures.append({'file': m.group(1), 'line': None, 'message': m.group(2).strip()})
    return failures


def map_files_to_tickets(failures, manifest_dir):
    ticket_map = {}  # {ticket_id: [failures]}
    if not os.path.isdir(manifest_dir):
        return {'unknown': {'failures': failures}} if failures else {}

    # Build reverse map: file_path → ticket_id
    file_to_ticket = {}
    for fname in os.listdir(manifest_dir):
        if not (fname.startswith('TASK-') and fname.endswith('.json')):
            continue
        fpath = os.path.join(manifest_dir, fname)
        try:
            with open(fpath) as mf:
                manifest = json.load(mf)
        except (json.JSONDecodeError, OSError):
            continue
        ticket_id = manifest.get('ticket_id') or fname.replace('.json', '')
        for f in manifest.get('provides', {}).get('new_files', []):
            file_to_ticket[f] = ticket_id
            bn = os.path.basename(f)
            if bn not in file_to_ticket:
                file_to_ticket[bn] = ticket_id
        for f in manifest.get('provides', {}).get('modified_files', []):
            file_to_ticket[f] = ticket_id
            bn = os.path.basename(f)
            if bn not in file_to_ticket:
                file_to_ticket[bn] = ticket_id

    for failure in failures:
        fpath = failure['file']
        ticket_id = (
            file_to_ticket.get(fpath)
            or file_to_ticket.get(os.path.basename(fpath))
            or 'unknown'
        )
        if ticket_id not in ticket_map:
            ticket_map[ticket_id] = {'failures': []}
        ticket_map[ticket_id]['failures'].append(failure)

    return ticket_map


def main():
    parser = argparse.ArgumentParser(description='Parse reviewer output for test failures.')
    parser.add_argument('--reviewer-output', default=REVIEWER_OUTPUT_DEFAULT)
    parser.add_argument('--manifest-dir', default=MANIFEST_DIR_DEFAULT)
    args = parser.parse_args()

    try:
        with open(args.reviewer_output) as f:
            text = f.read()
    except OSError as e:
        print(f'ERROR: cannot read reviewer output: {e}', file=sys.stderr)
        sys.exit(1)

    failures = parse_failures(text)
    result = map_files_to_tickets(failures, args.manifest_dir)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
