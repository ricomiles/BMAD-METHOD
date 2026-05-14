#!/usr/bin/env python3
"""
parse_iv_failures.py — Parse Integration Validation Report and map failures to ticket IDs.
Usage:
  python3 scripts/parse_iv_failures.py --iv-output <path> --manifest-dir <path>

Output: JSON to stdout, format: {ticket_id: {"failures": [{file, line, message}]}}
Tickets that cannot be attributed go under "unknown" key.
"""

import sys
import os
import re
import json
import glob
import argparse


def load_manifests(manifests_dir):
    pattern = os.path.join(manifests_dir, 'TASK-*.json')
    files = sorted(glob.glob(pattern))
    manifests = []
    for fpath in files:
        try:
            with open(fpath, encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        manifests.append(data)
    return manifests


def build_file_to_ticket(manifests):
    """Returns dict of file_path → ticket_id for all new/modified source files."""
    file_map = {}
    for m in manifests:
        tid = m.get('ticket_id')
        if not tid:
            continue
        provides = m.get('provides') or {}
        for fp in (provides.get('new_files') or []):
            file_map[fp] = tid
        for fp in (provides.get('modified_files') or []):
            file_map[fp] = tid
    return file_map


def parse_iv_report(content, file_to_ticket):
    """Parse validate_interfaces.py stdout. Returns {ticket_id: {failures: [...]}}."""
    result = {}

    def add_failure(ticket_id, file_, line, message):
        if ticket_id not in result:
            result[ticket_id] = {'failures': []}
        entry = {'file': file_, 'message': message}
        if line is not None:
            entry['line'] = line
        result[ticket_id]['failures'].append(entry)

    lines = content.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]

        # MISMATCH: "  ✗ MISMATCH {consumer} ← {provider} :: {interface}"
        # Repair the PROVIDER — their export signature doesn't match the contract.
        m = re.match(r'\s*✗\s+MISMATCH\s+(\S+)\s+←\s+(\S+)\s+::\s+(\S+)', line)
        if m:
            consumer, provider, interface = m.group(1), m.group(2), m.group(3)
            expected = actual = None
            if i + 1 < len(lines) and lines[i + 1].strip().startswith('Expected:'):
                expected = lines[i + 1].strip()[len('Expected:'):].strip()
                i += 1
            if i + 1 < len(lines) and lines[i + 1].strip().startswith('Actual:'):
                actual = lines[i + 1].strip()[len('Actual:'):].strip()
                i += 1
            msg = f'INTERFACE_MISMATCH: {consumer} expects {interface}'
            if expected:
                msg += f' — expected: {expected}'
            if actual:
                msg += f' — actual: {actual}'
            ticket = provider if re.match(r'^[A-Z]+-\d+$', provider) else 'unknown'
            add_failure(ticket, provider, None, msg)
            i += 1
            continue

        # UNRESOLVED: "  ✗ UNRESOLVED  {file}:{line} → {import_path}"
        m = re.match(r'\s*✗\s+UNRESOLVED\s+(.+?):(\d+)\s+→\s+(.+)', line)
        if m:
            file_ = m.group(1).strip()
            lineno = int(m.group(2))
            import_path = m.group(3).strip()
            ticket = file_to_ticket.get(file_, 'unknown')
            msg = f'UNRESOLVED_IMPORT: {import_path}'
            add_failure(ticket, file_, lineno, msg)
            i += 1
            continue

        i += 1

    return result


def main():
    parser = argparse.ArgumentParser(
        description='Parse Integration Validation Report and map failures to ticket IDs.'
    )
    parser.add_argument('--iv-output', required=True, dest='iv_output',
                        help='Path to integration-validator output.md')
    parser.add_argument('--manifest-dir', required=True, dest='manifest_dir',
                        help='Directory containing TASK-NNN.json manifest files')
    args = parser.parse_args()

    try:
        with open(args.iv_output, encoding='utf-8') as f:
            content = f.read()
    except OSError as e:
        print(f'ERROR: Cannot read IV output: {e}', file=sys.stderr)
        sys.exit(1)

    if not os.path.isdir(args.manifest_dir):
        print(f'ERROR: Manifest directory not found: {args.manifest_dir}', file=sys.stderr)
        sys.exit(1)

    manifests = load_manifests(args.manifest_dir)
    file_to_ticket = build_file_to_ticket(manifests)
    result = parse_iv_report(content, file_to_ticket)

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
