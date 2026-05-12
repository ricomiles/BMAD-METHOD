#!/usr/bin/env python3
"""
assemble_context.py — Assemble bounded developer context from a ticket manifest.
Usage:
  python3 scripts/assemble_context.py --manifest <path> [options]

Options:
  --manifest      Path to TASK-NNN.json manifest (required)
  --arch          Path to architecture doc (default: docs/architecture.md with fallback to .autopilot/stages/architect/output.md)
  --brief         Path to project brief (default: PROJECT_BRIEF.md)
  --adr-dir       Directory containing ADR files (default: docs/ADRs with fallback to .autopilot/stages/architect/ADRs)
  --tasks         Path to TASKS.md from task-breakdown (default: .autopilot/stages/task-breakdown/output.md)
  --project-root  Project root for path confinement of manifest-supplied paths (default: current working directory)
"""

import sys
import os
import json
import re
import argparse

ARCH_DEFAULTS = ["docs/architecture.md", ".autopilot/stages/architect/output.md"]
ADR_DIR_DEFAULTS = ["docs/ADRs", ".autopilot/stages/architect/ADRs"]
BRIEF_DEFAULT = "PROJECT_BRIEF.md"
TASKS_DEFAULT = ".autopilot/stages/task-breakdown/output.md"


def confine_path(path, project_root):
    """Resolve path and verify it stays within project_root. Exits non-zero if it escapes."""
    abs_root = os.path.realpath(project_root)
    if os.path.isabs(path):
        abs_path = os.path.realpath(path)
    else:
        abs_path = os.path.realpath(os.path.join(project_root, path))
    if not (abs_path == abs_root or abs_path.startswith(abs_root + os.sep)):
        print(f'ERROR: Path escapes project root: {path}', file=sys.stderr)
        sys.exit(1)
    return abs_path


def extract_markdown_section(content, section_name):
    """Extract a named section from markdown, heading to next same-level heading."""
    lines = content.splitlines()
    target = re.sub(r'[^a-z0-9 ]', ' ', section_name.lower()).strip()

    if not target:
        return ''

    start_idx = None
    heading_level = None
    for i, line in enumerate(lines):
        if not line.startswith('#'):
            continue
        level = len(line) - len(line.lstrip('#'))
        heading_text = re.sub(r'[^a-z0-9 ]', ' ', line.lstrip('#').strip().lower())
        if target in heading_text or all(w in heading_text for w in target.split()):
            start_idx = i
            heading_level = level
            break

    if start_idx is None:
        return ''

    end_idx = len(lines)
    for i in range(start_idx + 1, len(lines)):
        if lines[i].startswith('#'):
            lvl = len(lines[i]) - len(lines[i].lstrip('#'))
            if lvl <= heading_level:
                end_idx = i
                break

    return '\n'.join(lines[start_idx:end_idx]).strip()


def find_adr_file(adr_dir, adr_id):
    """Find the file in adr_dir whose name starts with adr_id (case-insensitive)."""
    prefix = adr_id.upper()
    for fname in sorted(os.listdir(adr_dir)):
        full_path = os.path.join(adr_dir, fname)
        if os.path.isfile(full_path) and fname.upper().startswith(prefix):
            return full_path
    return None


def extract_ticket_definition(tasks_content, ticket_id):
    """Extract ticket section from TASKS.md by ticket_id."""
    lines = tasks_content.splitlines()
    start_idx = None
    heading_level = None
    for i, line in enumerate(lines):
        if ticket_id.upper() in line.upper() and line.startswith('#'):
            # Ensure ticket_id is a whole token, not a prefix of a longer ID
            idx = line.upper().find(ticket_id.upper())
            end = idx + len(ticket_id)
            if end < len(line) and (line[end].isalnum() or line[end] in '-_'):
                continue
            start_idx = i
            heading_level = len(line) - len(line.lstrip('#'))
            break

    if start_idx is None:
        return f'[Ticket definition not found for {ticket_id} in TASKS.md]'

    end_idx = len(lines)
    for i in range(start_idx + 1, len(lines)):
        if lines[i].startswith('#'):
            lvl = len(lines[i]) - len(lines[i].lstrip('#'))
            if lvl <= heading_level:
                end_idx = i
                break

    return '\n'.join(lines[start_idx:end_idx]).strip()


def resolve_path_with_fallback(explicit, defaults, kind='file'):
    """Return first existing path: explicit (if given) else first matching default.

    kind='file' requires os.path.isfile(); kind='dir' requires os.path.isdir().
    """
    check = os.path.isfile if kind == 'file' else os.path.isdir
    if explicit:
        return explicit if check(explicit) else None
    for path in defaults:
        if check(path):
            return path
    return None


def load_manifest(manifest_path):
    """Load and validate manifest JSON. Exits non-zero on missing file or invalid JSON."""
    if not os.path.exists(manifest_path):
        print(f'ERROR: Manifest file not found: {manifest_path}', file=sys.stderr)
        sys.exit(1)
    try:
        with open(manifest_path, encoding='utf-8') as f:
            manifest = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f'ERROR: Cannot read manifest {manifest_path}: {e}', file=sys.stderr)
        sys.exit(1)
    for key in ('ticket_id', 'requires', 'provides'):
        if key not in manifest:
            print(f'ERROR: Manifest missing required key: {key}', file=sys.stderr)
            sys.exit(1)
    if not isinstance(manifest['requires'], dict):
        print('ERROR: Manifest "requires" must be an object', file=sys.stderr)
        sys.exit(1)
    return manifest


def build_context_notes(requires):
    """Build the MANIFEST CONTEXT NOTES block for env_vars and interfaces."""
    lines = []
    env_vars = requires.get('env_vars', [])
    interfaces = requires.get('interfaces', [])
    if env_vars:
        lines.append(f'Required env vars: {", ".join(env_vars)}')
    if interfaces:
        iface_parts = []
        for iface in interfaces:
            if isinstance(iface, dict):
                name = iface.get('name', str(iface))
                defined_in = iface.get('defined_in', '')
                why = iface.get('why', '')
                descriptors = []
                if defined_in:
                    descriptors.append(f'defined_in: {defined_in}')
                if why:
                    descriptors.append(f'why: {why}')
                iface_parts.append(f'{name} ({", ".join(descriptors)})' if descriptors else name)
            else:
                iface_parts.append(str(iface))
        lines.append(f'Required interfaces: {", ".join(iface_parts)}')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Assemble bounded developer context from a ticket manifest.')
    parser.add_argument('--manifest', required=True, help='Path to TASK-NNN.json manifest')
    parser.add_argument('--arch', default=None, help='Path to architecture document')
    parser.add_argument('--brief', default=None, help='Path to project brief')
    parser.add_argument('--adr-dir', default=None, dest='adr_dir', help='Directory containing ADR files')
    parser.add_argument('--tasks', default=None, help='Path to TASKS.md from task-breakdown')
    parser.add_argument('--project-root', default=None, dest='project_root', help='Project root for path confinement (default: cwd)')
    args = parser.parse_args()

    project_root = os.path.realpath(args.project_root if args.project_root else os.getcwd())

    manifest = load_manifest(args.manifest)
    ticket_id = manifest['ticket_id']
    requires = manifest.get('requires', {})

    if args.adr_dir:
        args.adr_dir = confine_path(args.adr_dir, project_root)
    arch_path = resolve_path_with_fallback(args.arch, ARCH_DEFAULTS, kind='file')
    adr_dir = resolve_path_with_fallback(args.adr_dir, ADR_DIR_DEFAULTS, kind='dir')
    brief_path = args.brief if args.brief else BRIEF_DEFAULT
    tasks_path = args.tasks if args.tasks else TASKS_DEFAULT

    output_parts = []

    # 1. Ticket definition
    if os.path.exists(tasks_path):
        try:
            with open(tasks_path, encoding='utf-8') as f:
                tasks_content = f.read()
        except (UnicodeDecodeError, OSError) as e:
            print(f'WARNING: Could not read tasks file: {e}', file=sys.stderr)
            tasks_content = ''
        ticket_def = extract_ticket_definition(tasks_content, ticket_id)
    else:
        print(f'WARNING: Tasks file not found: {tasks_path} — ticket definition skipped', file=sys.stderr)
        ticket_def = f'[Tasks file not found: {tasks_path}]'

    output_parts.append(f'=== TICKET DEFINITION: {ticket_id} ===\n{ticket_def}')

    # 2. Manifest context notes (env_vars, interfaces)
    context_notes = build_context_notes(requires)
    if context_notes:
        output_parts.append(f'=== MANIFEST CONTEXT NOTES ===\n{context_notes}')

    # 3. Brief sections
    brief_sections = requires.get('brief_sections', [])
    if brief_sections:
        brief_content = ''
        if os.path.exists(brief_path):
            try:
                with open(brief_path, encoding='utf-8') as f:
                    brief_content = f.read()
            except (UnicodeDecodeError, OSError) as e:
                print(f'WARNING: Could not read brief file: {e}', file=sys.stderr)
        else:
            print(f'WARNING: Brief file not found: {brief_path}', file=sys.stderr)

        section_parts = []
        for section_name in brief_sections:
            if brief_content:
                extracted = extract_markdown_section(brief_content, section_name)
                if extracted:
                    section_parts.append(f'--- Section: {section_name} ---\n{extracted}')
                else:
                    print(f'WARNING: Brief section not found: {section_name}', file=sys.stderr)
                    section_parts.append(f'--- Section: {section_name} ---\n[Section not found in brief]')
            else:
                section_parts.append(f'--- Section: {section_name} ---\n[Brief file not available]')

        if section_parts:
            output_parts.append('=== BRIEF SECTIONS ===\n' + '\n\n'.join(section_parts))

    # 4. Architecture sections
    arch_sections = requires.get('architecture_sections', [])
    if arch_sections:
        arch_content = ''
        if arch_path:
            try:
                with open(arch_path, encoding='utf-8') as f:
                    arch_content = f.read()
            except (UnicodeDecodeError, OSError) as e:
                print(f'WARNING: Could not read architecture file: {e}', file=sys.stderr)
        else:
            print('WARNING: Architecture document not found — architecture sections skipped', file=sys.stderr)

        section_parts = []
        for section_name in arch_sections:
            if arch_content:
                extracted = extract_markdown_section(arch_content, section_name)
                if extracted:
                    section_parts.append(f'--- Section: {section_name} ---\n{extracted}')
                else:
                    print(f'WARNING: Architecture section not found: {section_name}', file=sys.stderr)
                    section_parts.append(f'--- Section: {section_name} ---\n[Section not found in architecture doc]')
            else:
                section_parts.append(f'--- Section: {section_name} ---\n[Architecture document not available]')

        if section_parts:
            output_parts.append('=== ARCHITECTURE SECTIONS ===\n' + '\n\n'.join(section_parts))

    # 5. ADRs
    adr_ids = requires.get('adrs', [])
    if adr_ids:
        if not adr_dir:
            print('WARNING: No ADR directory found — ADR sections skipped', file=sys.stderr)
        else:
            adr_parts = []
            for adr_id in adr_ids:
                adr_file = find_adr_file(adr_dir, adr_id)
                if not adr_file:
                    print(f'ERROR: ADR not found: {adr_id} (searched in {adr_dir})', file=sys.stderr)
                    sys.exit(1)
                try:
                    with open(adr_file, encoding='utf-8') as f:
                        adr_content = f.read()
                except (UnicodeDecodeError, OSError) as e:
                    print(f'WARNING: Could not read ADR {adr_id}: {e}', file=sys.stderr)
                    adr_parts.append(f'--- ADR: {os.path.basename(adr_file)} ---\n[ERROR: could not read file: {e}]')
                    continue
                adr_parts.append(f'--- ADR: {os.path.basename(adr_file)} ---\n{adr_content.strip()}')

            if adr_parts:
                output_parts.append('=== ARCHITECTURE DECISION RECORDS ===\n' + '\n\n'.join(adr_parts))

    # 6. Existing files
    existing_files = requires.get('existing_files', [])
    if existing_files:
        file_parts = []
        for file_path in existing_files:
            confined_path = confine_path(file_path, project_root)
            if not os.path.exists(confined_path):
                print(f'WARNING: existing file not found: {file_path} — including placeholder', file=sys.stderr)
                file_parts.append(f'--- File: {file_path} ---\n[FILE NOT FOUND — may not have been created yet by a prior ticket]')
                continue
            try:
                with open(confined_path, encoding='utf-8') as f:
                    file_content = f.read()
            except (UnicodeDecodeError, OSError) as e:
                print(f'WARNING: Could not read file {file_path}: {e}', file=sys.stderr)
                file_parts.append(f'--- File: {file_path} ---\n[ERROR: could not read file: {e}]')
                continue
            file_parts.append(f'--- File: {file_path} ---\n{file_content.strip()}')

        if file_parts:
            output_parts.append('=== EXISTING FILES ===\n' + '\n\n'.join(file_parts))

    print('\n\n'.join(output_parts))


if __name__ == '__main__':
    main()
