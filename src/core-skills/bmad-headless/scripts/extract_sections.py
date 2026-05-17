#!/usr/bin/env python3
"""
Extract specific markdown sections from a document for section-scoped gate.

Usage: extract_sections.py <document_path> <sections_json>

sections_json: JSON array of failing section heading strings from triage.

Exits 0 and prints extracted content (preamble + matched sections).
Falls back to full document (exit 0) if: any heading doesn't match,
extracted word count > 70% of total, or extracted content < 1200 chars.
Exits 1 only on argument/file/JSON errors.
"""
import sys
import json
import re


def parse_sections(content):
    """
    Split on H2 boundaries (## ); fall back to H1 if no H2 present.
    Returns (preamble: str, sections: list[(heading_text, block_text)]).
    Each block includes its heading line and all sub-content through the next
    same-level heading.
    """
    split_level = 2 if re.search(r'(?m)^## ', content) else 1
    pat = re.compile(r'(?m)^#{' + str(split_level) + r'} .+$')

    positions = [(m.start(), re.sub(r'^#+\s*', '', m.group()).strip())
                 for m in pat.finditer(content)]

    if not positions:
        return content, []

    preamble = content[:positions[0][0]].rstrip('\n')
    sections = []
    for i, (pos, heading) in enumerate(positions):
        end = positions[i + 1][0] if i + 1 < len(positions) else len(content)
        block = content[pos:end].rstrip('\n')
        sections.append((heading, block))

    return preamble, sections


def find_section_idx(sections, query):
    """
    Case-insensitive fuzzy substring match.
    Strips leading # chars from query. Returns first matching index or -1.
    """
    q = re.sub(r'^#+\s*', '', query).strip().lower()
    for idx, (heading, _) in enumerate(sections):
        h = heading.lower()
        if q in h or h in q:
            return idx
    return -1


def main():
    if len(sys.argv) < 3:
        print(f'Usage: {sys.argv[0]} <document_path> <sections_json>', file=sys.stderr)
        sys.exit(1)

    doc_path = sys.argv[1]
    try:
        content = open(doc_path).read()
    except OSError as e:
        print(f'extract_sections.py: cannot read {doc_path}: {e}', file=sys.stderr)
        sys.exit(1)

    try:
        requested = json.loads(sys.argv[2])
    except (json.JSONDecodeError, ValueError) as e:
        print(f'extract_sections.py: invalid sections JSON: {e}', file=sys.stderr)
        sys.exit(1)

    if not isinstance(requested, list) or not requested:
        print(content, end='')
        sys.exit(0)

    requested = [r for r in requested if isinstance(r, str) and r.strip()]
    if not requested:
        print(content, end='')
        sys.exit(0)

    preamble, sections = parse_sections(content)

    seen_idxs = set()
    matched = []
    for req in requested:
        idx = find_section_idx(sections, req)
        if idx == -1:
            print(
                f"extract_sections.py: WARNING: no match for '{req}' "
                f"— falling back to full document",
                file=sys.stderr,
            )
            print(content, end='')
            sys.exit(0)
        if idx not in seen_idxs:
            seen_idxs.add(idx)
            matched.append(sections[idx][1])

    parts = []
    if preamble.strip():
        parts.append(preamble)
    parts.extend(matched)
    extracted = '\n\n'.join(parts)

    total_words = len(content.split())
    extracted_words = len(extracted.split())

    if total_words > 0 and extracted_words > total_words * 0.70:
        pct = 100 * extracted_words // total_words
        print(
            f'extract_sections.py: failing sections are {extracted_words}/{total_words} '
            f'words ({pct}%) — exceeds 70% threshold, using full document',
            file=sys.stderr,
        )
        print(content, end='')
        sys.exit(0)

    if len(extracted) < 1200:
        print(
            f'extract_sections.py: extracted content is {len(extracted)} chars '
            f'(< ~300 tokens) — using full document',
            file=sys.stderr,
        )
        print(content, end='')
        sys.exit(0)

    print(extracted, end='')


if __name__ == '__main__':
    main()
