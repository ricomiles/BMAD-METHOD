#!/usr/bin/env python3
"""
validate_brief.py — Validate PROJECT_BRIEF.md before pipeline start
Usage: python3 scripts/validate_brief.py <brief_path>
Exit 0: brief is valid, pipeline can start
Exit 1: brief has blocking issues, fix before running
"""

import sys
import re

def validate(path):
    try:
        with open(path) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    errors = []    # Blocking — pipeline will not start
    warnings = []  # Non-blocking — pipeline will start but may hit gate failures

    text = content.lower()

    # ─── BLOCKING checks ─────────────────────────────────────────────────────

    # Project overview
    overview_section = extract_section(content, ["overview", "about", "what"])
    if not overview_section or len(overview_section.split()) < 30:
        errors.append("Project overview is missing or too short (< 30 words). "
                      "Add a section explaining what is being built, for whom, and why.")

    # Core features
    features_section = extract_section(content, ["feature", "scope", "functionality", "what it does"])
    if not features_section:
        errors.append("No core features / scope section found. "
                      "Add a section listing what the project must do.")
    else:
        # Count feature-like items (bullets, numbered items, or sentences with verbs)
        bullets = re.findall(r'^[-*•]\s+.+', features_section, re.MULTILINE)
        numbered = re.findall(r'^\d+\.\s+.+', features_section, re.MULTILINE)
        if len(bullets) + len(numbered) < 2:
            errors.append("Core features section has fewer than 2 listed items. "
                          "Use a bullet list to enumerate features explicitly.")

    # Tech stack
    tech_section = extract_section(content, ["tech", "stack", "technology", "languages", "framework"])
    if not tech_section:
        errors.append("No tech stack section found. "
                      "Specify at minimum: language, framework, and database (or 'no database').")
    else:
        has_lang = any(lang in tech_section.lower() for lang in [
            "python", "javascript", "typescript", "ruby", "go", "rust",
            "java", "kotlin", "swift", "c#", "php", "elixir"
        ])
        if not has_lang:
            errors.append("Tech stack section doesn't mention a programming language. "
                          "Add the language explicitly.")

    # Definition of done
    done_section = extract_section(content, ["done", "complete", "complete when", "definition", "acceptance"])
    if not done_section or len(done_section.split()) < 10:
        errors.append("Definition of done is missing or too vague. "
                      "Add a section describing concretely how to verify the project is complete.")

    # Placeholder text
    placeholders = re.findall(r'\b(TODO|TBD|to be determined|to be decided|placeholder|FIXME|xxx)\b',
                              content, re.IGNORECASE)
    if placeholders:
        errors.append(f"Brief contains placeholder text: {set(placeholders)}. "
                      "Replace all placeholders with real decisions before running.")

    # ─── WARNING checks ───────────────────────────────────────────────────────

    # Out of scope
    if "out of scope" not in text and "not in scope" not in text and "won't" not in text:
        warnings.append("No 'out of scope' section found. "
                        "Without it, the architect may gold-plate with features you don't want.")

    # Quality bar
    if not extract_section(content, ["quality", "testing", "test", "lint", "coverage"]):
        warnings.append("No quality bar / testing section found. "
                        "The pipeline will use conservative defaults.")

    # Constraints
    if not extract_section(content, ["constraint", "non-negotiable", "must not", "requirement"]):
        warnings.append("No constraints section found. "
                        "The pipeline will make all discretionary decisions on its own.")

    # Word count sanity check
    word_count = len(content.split())
    if word_count < 100:
        warnings.append(f"Brief is only {word_count} words. "
                        "A brief this short will likely cause quality gate failures. "
                        "Aim for at least 150-300 words for a small project.")

    # ─── Report ───────────────────────────────────────────────────────────────

    print(f"\nBrief validation: {path}")
    print(f"Length: {word_count} words, {len(content.splitlines())} lines\n")

    if errors:
        print(f"BLOCKING ISSUES ({len(errors)}) — pipeline cannot start:")
        for i, err in enumerate(errors, 1):
            print(f"  {i}. {err}")
        print()

    if warnings:
        print(f"WARNINGS ({len(warnings)}) — pipeline will start but expect gate failures:")
        for i, warn in enumerate(warnings, 1):
            print(f"  {i}. {warn}")
        print()

    if not errors and not warnings:
        print("✓ Brief looks good. Pipeline can start.\n")
    elif not errors:
        print("✓ No blocking issues. Warnings above are advisory.\n")
    else:
        print("✗ Fix blocking issues before running the pipeline.\n")
        sys.exit(1)


def extract_section(content, keywords):
    """
    Extract content from a markdown section whose heading contains any of the keywords.
    Returns the section body (up to the next heading), or None if not found.
    """
    lines = content.splitlines()
    in_section = False
    section_lines = []

    for line in lines:
        # Check if this is a heading line
        if re.match(r'^#{1,3}\s+', line):
            heading_text = re.sub(r'^#+\s+', '', line).lower()
            if any(kw in heading_text for kw in keywords):
                in_section = True
                section_lines = []
                continue
            elif in_section:
                # Reached a new heading — section is over
                break
        elif in_section:
            section_lines.append(line)

    if section_lines:
        return "\n".join(section_lines).strip()

    # Fallback: search for keyword anywhere with some context
    for kw in keywords:
        if kw in content.lower():
            idx = content.lower().index(kw)
            return content[idx:idx+500]

    return None

def is_brownfield(path):
    """Detect brownfield mode from brief content."""
    try:
        with open(path) as f:
            content = f.read().lower()
        # Handle "mode: brownfield" inline or "## Mode\nbrownfield" section format
        return "brownfield" in content
    except FileNotFoundError:
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 validate_brief.py <brief_path>")
        sys.exit(1)

    brief_path = sys.argv[1]

    if is_brownfield(brief_path):
        print("[brownfield mode detected]")

        try:
            with open(brief_path) as f:
                content = f.read()
        except FileNotFoundError:
            print(f"ERROR: File not found: {brief_path}")
            sys.exit(1)

        errors = []
        warnings = []
        word_count = len(content.split())

        # Placeholder text (always blocking)
        placeholders = re.findall(r'\b(TODO|TBD|to be determined|to be decided|FIXME)\b',
                                  content, re.IGNORECASE)
        if placeholders:
            errors.append(f"Brief contains placeholder text: {set(placeholders)}.")

        # Tech stack still required
        has_lang = any(lang in content.lower() for lang in [
            "python", "javascript", "typescript", "ruby", "go", "rust",
            "java", "kotlin", "swift", "c#", "php", "elixir"
        ])
        if not has_lang:
            errors.append("Tech stack: no programming language found.")

        # Sprint context
        if not extract_section(content, ["sprint context", "sprint status", "sprint board", "sprint goal"]):
            errors.append("[brownfield] No sprint context section. "
                          "Add sprint status: done, in-progress, this-run scope, blocked.")

        # This run scope
        scope = extract_section(content, ["this sprint", "this run", "scope", "in scope"])
        if not scope or len(scope.split()) < 8:
            errors.append("[brownfield] Sprint scope not defined. "
                          "List ticket IDs autopilot should build this run.")

        # Do-not-touch
        dnt = content.lower()
        if "do not touch" not in dnt and "don't touch" not in dnt and "do-not-touch" not in dnt:
            errors.append("[brownfield] No 'do not touch' section. Required even if empty — write 'none'.")

        # Definition of done
        done_section = extract_section(content, ["done", "complete", "definition", "acceptance"])
        if not done_section or len(done_section.split()) < 8:
            errors.append("Definition of done missing or too vague.")

        # Warnings
        if word_count < 80:
            warnings.append(f"Brief is only {word_count} words — add more context.")

        board_signals = ["http", "jira", "linear", "notion", "github", "asana"]
        if not any(s in content.lower() for s in board_signals):
            warnings.append("[brownfield] No sprint board URL found — will use manual sprint context only.")

        if "architecture" not in content.lower() and "docs/" not in content.lower():
            warnings.append("[brownfield] No existing architecture doc path — will infer from codebase.")

        print(f"\nBrief validation: {brief_path}")
        print(f"Length: {word_count} words\n")

        if errors:
            print(f"BLOCKING ISSUES ({len(errors)}) — pipeline cannot start:")
            for i, err in enumerate(errors, 1):
                print(f"  {i}. {err}")
            print()
        if warnings:
            print(f"WARNINGS ({len(warnings)}):")
            for i, warn in enumerate(warnings, 1):
                print(f"  {i}. {warn}")
            print()

        if not errors:
            print("✓ Brownfield brief looks good. Pipeline can start.\n")
        else:
            print("✗ Fix blocking issues before running the pipeline.\n")
            sys.exit(1)
    else:
        validate(brief_path)
