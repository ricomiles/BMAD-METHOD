# Brownfield Mode

Brownfield mode is activated when `PROJECT_BRIEF.md` contains `mode: brownfield`.
It adapts every stage to work with an existing codebase and sprint context
rather than designing from scratch.

---

## How brownfield differs from greenfield

| Aspect | Greenfield | Brownfield |
|---|---|---|
| First stage | analyst | context-ingestion |
| analyst output | Full PRD | Sprint scope (delta only) |
| architect output | Full system design | Delta design + pattern inventory |
| task-breakdown | New ticket IDs | Maps to existing ticket IDs |
| developer input | Blank canvas | Reads existing code first |
| Quality gate | "Is it complete?" | "Does it fit the existing system?" |

---

## Brownfield brief schema

In addition to the standard brief fields, brownfield briefs require:

```markdown
## Mode
brownfield

## Sprint context
- Sprint name/number: Sprint 24
- Sprint goal: Add invoice PDF export to the existing billing module
- Sprint board: <Notion URL | Jira project key | GitHub project URL | "none">
- Current sprint status: (paste or describe — what's done, in progress, blocked)
  - DONE: USER-101 (auth refactor), USER-102 (email templates)
  - IN PROGRESS: BILL-045 (payment webhook handler)
  - TODO: BILL-046 (PDF export), BILL-047 (export history)
  - BLOCKED: BILL-048 (depends on BILL-046)

## Existing codebase
- Repo root: /path/to/project  (or "current directory")
- Key entry points: src/api/routes/, src/services/, src/models/
- Test location: tests/ (Vitest)
- Main patterns to follow:
  - All services extend BaseService in src/services/base.ts
  - API routes use Zod validation via validateRequest() middleware
  - DB queries go through the QueryBuilder in src/db/query-builder.ts
- Do NOT touch: src/auth/ (being refactored separately), legacy/ directory

## Existing architecture docs
- Architecture doc: docs/ARCHITECTURE.md (or "none — infer from codebase")
- ADRs: docs/ADRs/ (or "none")
- API spec: docs/api.yaml (or "none")

## This sprint's scope (what autopilot should build)
Only work on tickets marked TODO or BLOCKED-but-unblockable in sprint context above.
Specifically: BILL-046, BILL-047 (BILL-048 stays blocked, do not touch).
```

---

## Stage adaptations in brownfield mode

### Stage: context-ingestion (brownfield only, runs first)

**Purpose:** Produce a `CONTEXT.md` that gives all downstream stages a complete
picture of the existing system — so they extend rather than replace.

**What it does:**
1. Reads the codebase (uses bash to run `find`, `cat` key files)
2. Pulls sprint status from the configured board (Notion, Linear, Jira, etc.)
3. Reads existing architecture docs if present
4. Produces a structured `CONTEXT.md`

**Output structure (`CONTEXT.md`):**
```markdown
# Project Context: <name>

## Codebase snapshot
<file tree from find command>

## Key patterns (inferred from code)
- Service pattern: <example from actual code>
- Validation pattern: <example>
- Error handling pattern: <example>
- Test pattern: <example>

## Existing architecture summary
<from docs if present, otherwise inferred>

## Existing ADRs
<list with brief summaries>

## API contracts (existing)
<endpoints already implemented — so developer doesn't re-implement>

## Sprint status
- Done (skip entirely): <ticket list>
- In progress (do not conflict with): <ticket list>
- This run's scope: <ticket list with descriptions>
- Blocked (do not touch): <ticket list>

## Do-not-touch zones
<from brief + inferred from active branches if git is present>
```

**System prompt for context-ingestion:**
```
You are a senior engineer doing a codebase audit before a sprint.
Your job is to produce a CONTEXT.md that gives the pipeline a complete picture
of the existing system.

Use bash tools to:
1. Run `find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -v node_modules | grep -v .git | head -100` to map the codebase
2. Read key files identified in the brief (entry points, base classes, main patterns)
3. Read existing architecture docs if paths are provided in the brief
4. Pull sprint data from the board URL/key in the brief (use appropriate MCP or API)

Rules:
- Do NOT suggest changes — only document what exists
- Quote actual code snippets when documenting patterns (so developers copy them exactly)
- If you cannot access the sprint board, document the status from the brief's
  sprint context section and note that live board data was unavailable
- The context-ingestion output is the foundation — be thorough. A missed pattern
  means the developer stage will invent its own.
- Output ONLY the CONTEXT.md. No preamble.
```

**Quality gate checklist (context-ingestion):**
- [ ] Codebase file tree present
- [ ] At least 3 key code patterns documented with actual code snippets
- [ ] Sprint status section present with this run's scope clearly identified
- [ ] Do-not-touch zones listed
- [ ] Existing API contracts documented (even if just a summary)

---

### Stage: analyst (brownfield variant)

**In brownfield mode,** the analyst does NOT write a full PRD. Instead it produces
a **sprint scope document** — what we're building this sprint relative to what exists.

**Additional context consumed:** `CONTEXT.md` (from context-ingestion)

**Output structure (sprint scope):**
```markdown
# Sprint Scope: <sprint name>

## What we're building this sprint
<concise description — what changes, not a full PRD>

## Tickets in scope
### <TICKET-ID>: <title>
- Status: TODO
- Acceptance criteria (Given/When/Then):
  - Given...
- Files likely affected: <from context>
- Dependencies: <other tickets or existing code>

## What we're explicitly NOT changing
<from context — do-not-touch zones + out of scope from brief>

## Integration points with existing system
<which existing services/modules this sprint's work connects to>

## Definition of done for this sprint
<from brief, adapted to existing system>
```

**Modified system prompt addition (appended to standard analyst prompt):**
```
BROWNFIELD MODE: You are NOT writing a full PRD. You are writing a sprint scope.
- Reuse existing acceptance criteria from the sprint board tickets where available
- Reference existing code and patterns from CONTEXT.md — do not redesign what exists
- Every ticket should list which existing files it touches (from CONTEXT.md)
- Do NOT invent features. Stay strictly within the sprint's ticket scope.
```

---

### Stage: architect (brownfield variant)

**In brownfield mode,** the architect produces a **delta design** — only what's new
or changing, with explicit references to existing patterns that must be followed.

**Additional context consumed:** `CONTEXT.md`

**Output structure (delta design):**
```markdown
# Delta Design: <sprint name>

## What we're adding (new files/modules)
<list with rationale — must reference existing patterns from CONTEXT.md>

## What we're modifying (existing files)
<file: what changes and why>

## Pattern compliance
<for each new component: which existing pattern it follows, with code example>

## New ADRs (only if genuinely new decisions are needed)
<if everything follows existing patterns, this section may be empty>

## What we're deliberately NOT changing
<explicit list — reinforces do-not-touch>
```

**Modified system prompt addition:**
```
BROWNFIELD MODE: You are NOT designing a new system. You are extending an existing one.
- Every new component must follow patterns documented in CONTEXT.md
- If CONTEXT.md shows how existing services are structured, new services MUST match that structure exactly
- Only create ADRs for decisions not covered by existing ADRs
- If an existing ADR covers the decision, cite it — do not re-decide it
- The do-not-touch zones in CONTEXT.md are absolute — do not design changes to them
```

---

### Stage: task-breakdown (brownfield variant)

**In brownfield mode,** tickets map to existing ticket IDs from the sprint board.
The pipeline does not invent new ticket IDs — it works the sprint as defined.

**Modified system prompt addition:**
```
BROWNFIELD MODE:
- Use existing ticket IDs from the sprint scope document (e.g. BILL-046, BILL-047)
- Do NOT create tickets for already-done items (listed in CONTEXT.md sprint status)
- Do NOT create tickets for in-progress items owned by others
- Setup tickets are only needed if the sprint introduces a new dependency
- Order tickets to respect inter-sprint dependencies from CONTEXT.md
```

---

### Stage: developer (brownfield variant)

**In brownfield mode,** the developer reads existing files before writing.

**Modified system prompt addition:**
```
BROWNFIELD MODE:
- Before implementing any ticket, read the existing files it touches (listed in the ticket)
- Follow the patterns documented in CONTEXT.md — do not invent new patterns
- When modifying an existing file: preserve all existing functionality, only add/change
  what the ticket requires
- If an existing test file covers the module you're touching, add tests to it —
  do not create a parallel test file
- Do NOT refactor anything not in scope, even if you see improvements
```

---

## Sprint board integrations

The context-ingestion stage can pull live sprint status from:

### Notion (MCP available)
```
Sprint board URL in brief → context-ingestion uses Notion MCP to:
- Fetch the database/board
- Read ticket statuses, descriptions, acceptance criteria
- Map to the CONTEXT.md sprint status section
```

### Linear / Jira / GitHub Issues (no MCP — use API)
```
Add to PROJECT_BRIEF.md:
  sprint_board_token: <env var name, e.g. LINEAR_API_KEY>

context-ingestion uses bash to curl the API and parse ticket status.
Scripts for common boards are in scripts/integrations/.
```

### No board (manual)
```
Paste the sprint status directly into the brief's sprint context section.
context-ingestion skips the API call and reads from the brief.
```

---

## Brief validation changes for brownfield

`validate_brief.py` checks for additional fields when `mode: brownfield`:

**BLOCKING in brownfield:**
- [ ] `mode: brownfield` present
- [ ] Sprint context section present (even if just "see board at <URL>")
- [ ] "This sprint's scope" section — which tickets autopilot should build
- [ ] "Do NOT touch" list present (even if empty — must be explicit)

**WARNINGS in brownfield:**
- [ ] No codebase path — context-ingestion will attempt to use current directory
- [ ] No sprint board URL — will use brief's manual sprint context only
- [ ] No existing architecture doc — context-ingestion will infer from codebase (slower)
