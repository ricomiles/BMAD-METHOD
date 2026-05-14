#!/usr/bin/env python3
"""
validate_interfaces.py — Validate export signature contracts and import resolution across ticket manifests.
Usage:
  python3 scripts/validate_interfaces.py --manifests-dir <path> [options]

Options:
  --manifests-dir   Directory containing TASK-NNN.json manifest files (required)
  --source-root     Root directory for source file resolution (default: current working directory)
  --language        Language for export/import parsing: typescript (default: inferred from source files)
"""

import sys
import os
import re
import json
import glob
import argparse


def _try_confine(path, project_root):
    """Like confine_path but returns (abs_path, None) or (None, error_msg) — non-fatal."""
    abs_root = os.path.realpath(project_root)
    if os.path.isabs(path):
        abs_path = os.path.realpath(path)
    else:
        abs_path = os.path.realpath(os.path.join(project_root, path))
    if not (abs_path == abs_root or abs_path.startswith(abs_root + os.sep)):
        return None, f'path escapes source root: {path}'
    return abs_path, None


# ---------------------------------------------------------------------------
# TypeScript parsers
# ---------------------------------------------------------------------------

def _normalize_sig(sig):
    # Strip leading export/async prefixes so parsed sigs match manifest sigs
    sig = re.sub(r'^export\s+(?:async\s+)?', '', sig)
    sig = re.sub(r'^async\s+', '', sig)
    # Only strip a trailing { that has no closing } after it (block opener, not generic constraint)
    sig = re.sub(r'\s*\{[^}]*$', '', sig)
    sig = re.sub(r'\s*=\s*$', '', sig)
    return re.sub(r'\s+', ' ', sig).strip()


def parse_typescript_exports(content):
    """Returns dict of name → normalized signature string."""
    exports = {}
    lines = content.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        m = re.match(
            r'^export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)(?:\s+default)?\s+(\w+)',
            line
        )
        if m:
            name = m.group(1)
            decl = line
            # Multi-line: collect until open parens are balanced (handles `cb: () => void` etc.)
            if '(' in decl and decl.count('(') > decl.count(')'):
                j = i + 1
                while j < len(lines) and decl.count('(') > decl.count(')'):
                    decl += ' ' + lines[j].strip()
                    j += 1
                i = j - 1  # advance outer index past consumed continuation lines
            exports[name] = _normalize_sig(decl)
        i += 1
    return exports


def parse_typescript_imports(content):
    """Returns list of (line_number, import_path) for relative imports."""
    results = []
    lines = content.splitlines()
    # ^\s* allows indented imports (e.g., inside namespaces or conditional blocks)
    static_re = re.compile(r"""^\s*import\s+(?:[^'"]+)\s+from\s+['"]([^'"]+)['"]""")
    dynamic_re = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")
    for lineno, line in enumerate(lines, start=1):
        for pattern in (static_re, dynamic_re):
            for m in pattern.finditer(line):
                path = m.group(1)
                if path.startswith('./') or path.startswith('../'):
                    results.append((lineno, path))
    return results


def get_language_parser(language):
    """Returns (parse_exports, parse_imports) for the given language."""
    if language == 'typescript':
        return parse_typescript_exports, parse_typescript_imports
    print(f'ERROR: Unsupported language: {language}', file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Import resolution
# ---------------------------------------------------------------------------

EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '']
INDEX_NAMES = ['index.ts', 'index.tsx', 'index.js']


def resolve_import(import_path, from_file, source_root):
    """Returns True if the import resolves to an existing file under source_root."""
    abs_root = os.path.realpath(source_root)
    # Anchor from_file to source_root before computing the import base directory,
    # ensuring resolution is CWD-independent when source_root != CWD.
    abs_from = os.path.realpath(os.path.join(source_root, from_file))
    base = os.path.normpath(os.path.join(os.path.dirname(abs_from), import_path))
    # Pre-check: bail if the base path escapes source_root (covers all extensions and indices)
    abs_base = os.path.realpath(base)
    if not (abs_base == abs_root or abs_base.startswith(abs_root + os.sep)):
        print(f'WARNING: Import path escapes source root: {import_path}', file=sys.stderr)
        return False
    for ext in EXTENSIONS:
        if os.path.isfile(base + ext):
            return True
    for idx in INDEX_NAMES:
        if os.path.isfile(os.path.join(base, idx)):
            return True
    return False


# ---------------------------------------------------------------------------
# Manifest loading
# ---------------------------------------------------------------------------

def load_manifests(manifests_dir):
    """Load all TASK-*.json files sorted by filename."""
    pattern = os.path.join(manifests_dir, 'TASK-*.json')
    files = sorted(glob.glob(pattern))
    manifests = []
    for fpath in files:
        try:
            with open(fpath, encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f'WARNING: Could not read manifest {fpath}: {e}', file=sys.stderr)
            continue
        manifests.append(data)
    return manifests


def build_provides_map(manifests):
    """Returns dict of ticket_id → {exports, new_files, modified_files}."""
    provides_map = {}
    for m in manifests:
        tid = m.get('ticket_id')
        if not tid:
            continue
        provides = m.get('provides') or {}
        provides_map[tid] = {
            'exports': provides.get('exports') or [],
            'new_files': provides.get('new_files') or [],
            'modified_files': provides.get('modified_files') or [],
        }
    return provides_map


def build_all_source_files(manifests):
    """Returns flat list of (ticket_id, file_path) for all new+modified files."""
    result = []
    for m in manifests:
        tid = m.get('ticket_id')
        if not tid:
            continue
        provides = m.get('provides') or {}
        for fp in (provides.get('new_files') or []):
            result.append((tid, fp))
        for fp in (provides.get('modified_files') or []):
            result.append((tid, fp))
    return result


def infer_language(manifests):
    """Infer language from file extensions in provides.new_files."""
    for m in manifests:
        provides = m.get('provides') or {}
        for fp in (provides.get('new_files') or []):
            if fp.endswith('.ts') or fp.endswith('.tsx'):
                return 'typescript'
    print('WARNING: No TypeScript source files found in manifests; defaulting to --language typescript', file=sys.stderr)
    return 'typescript'


# ---------------------------------------------------------------------------
# Interface check loop
# ---------------------------------------------------------------------------

def run_interface_checks(manifests, provides_map, parse_exports, source_root):
    """Returns list of check result dicts."""
    results = []
    for m in manifests:
        consumer_id = m.get('ticket_id', '?')
        contracts = m.get('downstream_contracts') or []
        for contract in contracts:
            from_ticket = contract.get('from_ticket')
            interface = contract.get('interface')
            expected_sig = contract.get('expected_signature')

            if not from_ticket or not interface or expected_sig is None:
                print(
                    f'WARNING: Skipping incomplete downstream_contract in {consumer_id}: {contract}',
                    file=sys.stderr
                )
                continue

            entry = {
                'consumer': consumer_id,
                'provider': from_ticket,
                'interface': interface,
                'expected': expected_sig,
                'actual': None,
                'match': False,
                'reason': None,
            }

            if from_ticket not in provides_map:
                entry['reason'] = 'providing ticket not found in manifests'
                results.append(entry)
                continue

            provider = provides_map[from_ticket]
            export_decl = next(
                (e for e in provider['exports'] if e.get('name') == interface),
                None
            )
            if export_decl is None:
                entry['reason'] = f'export not declared in provides.exports of {from_ticket}'
                results.append(entry)
                continue

            source_file = export_decl.get('file')
            if not source_file:
                ts_files = [
                    f for f in provider['new_files']
                    if f.endswith('.ts') or f.endswith('.tsx')
                ]
                source_file = ts_files[0] if ts_files else None

            if not source_file:
                entry['reason'] = 'source file for export not found'
                results.append(entry)
                continue

            abs_source, err = _try_confine(source_file, source_root)
            if err:
                entry['reason'] = err
                results.append(entry)
                continue

            try:
                with open(abs_source, encoding='utf-8') as f:
                    content = f.read()
            except OSError as e:
                entry['reason'] = f'could not read source file {source_file}: {e}'
                results.append(entry)
                continue

            actual_exports = parse_exports(content)
            norm_expected = _normalize_sig(expected_sig)
            entry['expected'] = norm_expected

            if interface not in actual_exports:
                entry['reason'] = 'export name not found in actual file'
                results.append(entry)
                continue

            norm_actual = actual_exports[interface]
            entry['actual'] = norm_actual
            if norm_expected == norm_actual:
                entry['match'] = True
            else:
                entry['reason'] = 'signature mismatch'

            results.append(entry)

    return results


# ---------------------------------------------------------------------------
# Import resolution scan
# ---------------------------------------------------------------------------

def run_import_scan(all_source_files, parse_imports, source_root):
    """Returns list of unresolved import dicts."""
    unresolved = []
    seen = set()
    for _ticket_id, file_path in all_source_files:
        if file_path in seen:
            continue
        seen.add(file_path)

        abs_path, err = _try_confine(file_path, source_root)
        if err:
            print(f'WARNING: {err}', file=sys.stderr)
            continue

        if not os.path.isfile(abs_path):
            print(
                f'WARNING: Source file not found (may not be implemented yet): {file_path}',
                file=sys.stderr
            )
            continue

        try:
            with open(abs_path, encoding='utf-8') as f:
                content = f.read()
        except OSError as e:
            print(f'WARNING: Could not read source file {file_path}: {e}', file=sys.stderr)
            continue

        imports = parse_imports(content)
        for lineno, import_path in imports:
            if not resolve_import(import_path, file_path, source_root):
                unresolved.append({
                    'file': file_path,
                    'line': lineno,
                    'import': import_path,
                })

    return unresolved


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_report(manifests_dir, source_root, language, ticket_count,
                 interface_results, unresolved_imports):
    print('Integration Validation Report')
    print('==============================')
    print(f'Manifests:   {manifests_dir}  ({ticket_count} tickets)')
    print(f'Source root: {source_root}')
    print(f'Language:    {language}')
    print()

    print('Interface Checks:')
    if not interface_results:
        print('  (no downstream_contracts found)')
    for r in interface_results:
        consumer = r['consumer']
        provider = r['provider']
        iface = r['interface']
        if r['match']:
            print(f'  ✓ MATCH    {consumer} ← {provider} :: {iface}')
        else:
            print(f'  ✗ MISMATCH {consumer} ← {provider} :: {iface}')
            if r.get('expected') is not None:
                print(f'    Expected: {r["expected"]}')
            if r.get('actual') is not None:
                print(f'    Actual:   {r["actual"]}')
            elif r.get('reason'):
                # AC3: show Actual line even when the signature couldn't be determined
                print(f'    Actual:   (not determinable — {r["reason"]})')
    print()

    print('Import Resolution:')
    if not unresolved_imports:
        print('  No import issues detected.')
    else:
        for u in unresolved_imports:
            print(f'  ✗ UNRESOLVED  {u["file"]}:{u["line"]} → {u["import"]}')
    print()

    mismatch_count = sum(1 for r in interface_results if not r['match'])
    unresolved_count = len(unresolved_imports)
    total_checks = len(interface_results)

    if mismatch_count == 0 and unresolved_count == 0:
        print('Status: PASS')
        print(f'  0 mismatches, 0 unresolved imports across {total_checks} interface checks')
        return True
    else:
        print('Status: FAIL')
        if mismatch_count:
            print(f'  {mismatch_count} interface mismatch(es)')
        if unresolved_count:
            print(f'  {unresolved_count} unresolved import(s)')
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Validate export signature contracts and import resolution across ticket manifests.'
    )
    parser.add_argument('--manifests-dir', required=True, dest='manifests_dir',
                        help='Directory containing TASK-NNN.json manifest files')
    parser.add_argument('--source-root', default=None, dest='source_root',
                        help='Root directory for source file resolution (default: cwd)')
    parser.add_argument('--language', default=None,
                        help='Parsing language: typescript (default: inferred from source files)')
    args = parser.parse_args()

    if not os.path.isdir(args.manifests_dir):
        print(f'ERROR: Manifests directory not found: {args.manifests_dir}', file=sys.stderr)
        sys.exit(1)

    source_root = os.path.realpath(args.source_root if args.source_root else os.getcwd())

    manifests = load_manifests(args.manifests_dir)
    if not manifests:
        print(f'ERROR: No TASK-*.json manifests found in {args.manifests_dir}', file=sys.stderr)
        sys.exit(1)

    language = args.language if args.language else infer_language(manifests)
    parse_exports, parse_imports = get_language_parser(language)

    provides_map = build_provides_map(manifests)
    all_source_files = build_all_source_files(manifests)

    interface_results = run_interface_checks(manifests, provides_map, parse_exports, source_root)
    unresolved_imports = run_import_scan(all_source_files, parse_imports, source_root)

    passed = print_report(
        args.manifests_dir, source_root, language,
        len(manifests), interface_results, unresolved_imports
    )

    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
