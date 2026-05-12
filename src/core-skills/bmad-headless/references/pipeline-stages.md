# Pipeline Stages

Defines the stage sequence, what each stage consumes, what it produces, and
the system prompt used to invoke it via `claude -p`.

---

## Stage sequence

```
analyst → architect → task-breakdown → developer (parallel) → reviewer
```

Each stage's output becomes part of the context for all subsequent stages.

---

## Stage definitions

---

### Stage: analyst

**Purpose:** Turn the project brief into a full PRD that the architect can build
from without any additional input.

**Inputs consumed:**
- `PROJECT_BRIEF.md` (full)
- `PIPELINE_STATE.json` (for resume context only)

**Outputs produced:**
- `.autopilot/stages/analyst/output.md` (the PRD)

Structure of the PRD output:
```markdown
# PRD: <project name>

## Problem statement
<crisp 1-paragraph problem definition>

## User personas
<who uses this, their goals, their pain points>

## Functional requirements
<numbered list, each with: ID, description, acceptance criteria, priority>
  Example:
  FR-001 [HIGH] User can generate PDF invoice from YAML file
    - Given a valid invoice.yml, when `invoice generate invoice.yml` is run,
      then a PDF is created in the same directory
    - Given an invalid YAML, when the command runs, then a clear error message
      is printed and exit code is non-zero

## Non-functional requirements
<performance, security, compatibility, constraints from brief>

## Out of scope
<explicit list — mirrors the brief but may expand if brief was vague>

## Open questions
<IMPORTANT: if any exist, this is a quality gate blocker — the gate will FAIL>
```

**System prompt for `claude -p`:**
```
You are a senior product analyst running in fully automated mode.
Your job is to produce a complete PRD from the provided PROJECT_BRIEF.md.

Rules:
- Every functional requirement must have a clear acceptance criterion phrased
  as "Given X, when Y, then Z"
- Do NOT invent features not implied by the brief
- If the brief is ambiguous on a point, make the most conservative/minimal
  interpretation and note it in the PRD — do not leave it as an open question
- The "Open questions" section must be EMPTY. If you find yourself writing an
  open question, reread the brief and make a decision. If the brief truly gives
  no signal, pick the simplest reasonable option and document your reasoning
  in a "Decisions made" section instead.
- Output ONLY the PRD in markdown. No preamble, no explanation.
```

**Quality gate checklist (analyst):**
- [ ] All features from brief appear as functional requirements
- [ ] Every FR has at least one acceptance criterion in Given/When/Then form
- [ ] Non-functional requirements present (at minimum: the constraints from brief)
- [ ] Out of scope section present and non-empty
- [ ] Open questions section is EMPTY (any open question = gate fails)
- [ ] No invented features not in brief

---

### Stage: architect

**Purpose:** Produce a system design document and ADRs that a developer can
implement from directly — no further design decisions needed.

**Inputs consumed:**
- `PROJECT_BRIEF.md`
- `PIPELINE_STATE.json`
- `.autopilot/stages/analyst/output.md` (PRD)

**Outputs produced:**
- `.autopilot/stages/architect/output.md` (architecture doc)
- `.autopilot/stages/architect/ADRs/` (one file per decision)

Structure of the architecture output:
```markdown
# Architecture: <project name>

## System overview
<one diagram description + component list>

## Component breakdown
<for each component: name, responsibility, technology, interfaces>

## Data model
<entities, relationships, key fields — even if no DB, describe data structures>

## API / interface contracts
<endpoints or function signatures with types — whatever applies>

## Error handling strategy
<how errors propagate, what gets logged, what surfaces to user>

## Testing strategy
<what to unit test, what to integration test, what to e2e test>

## File/folder structure
<the actual directory tree the developer should create>

## ADR index
<links to ADR files>
```

ADR format (one file per decision):
```markdown
# ADR-001: <decision title>

Status: Accepted
Date: <pipeline run date>

## Context
<what problem required a decision>

## Decision
<what was decided>

## Rationale
<why — reference brief constraints where applicable>

## Consequences
<what this means for implementation>
```

**System prompt for `claude -p`:**
```
You are a senior software architect running in fully automated mode.
You will receive a PROJECT_BRIEF and a PRD. Produce a complete architecture
document and one ADR per significant technology or design decision.

Rules:
- Every technology choice that isn't explicitly specified in the brief requires
  an ADR explaining why that choice over common alternatives
- The file/folder structure must be specific enough that a developer can create
  it with `mkdir -p` commands — no ambiguity
- API contracts must include types (TypeScript types, OpenAPI, or equivalent)
- If the brief specifies a tech, use it — do not substitute
- No "we could also..." — make decisions and document them in ADRs
- Output ONLY the architecture markdown followed by the ADRs. No preamble.
  Separate ADRs with "--- ADR ---" delimiters so the script can split them.
```

**Quality gate checklist (architect):**
- [ ] All PRD functional requirements are addressed by the design
- [ ] File/folder structure is complete (every file that will be created is listed)
- [ ] API contracts have types (not just names)
- [ ] Error handling strategy present
- [ ] Testing strategy present
- [ ] One ADR per technology not specified in brief
- [ ] No decisions left unmade ("TBD", "to be determined" = gate fails)

---

### Stage: task-breakdown

**Purpose:** Convert the architecture into an ordered list of implementable tickets,
each small enough to be built in a single `claude -p` call.

**Inputs consumed:**
- `PROJECT_BRIEF.md`
- `.autopilot/stages/analyst/output.md` (PRD)
- `.autopilot/stages/architect/output.md` (architecture)

**Outputs produced:**
- `.autopilot/stages/task-breakdown/output.md` (TASKS.md)
- `.autopilot/stages/task-breakdown/manifests/TASK-NNN.json` (one per ticket)

Structure:
```markdown
# Tasks

## Implementation order
<numbered list — must respect dependencies>

## Tickets

### TASK-001: <title>
Stage: setup | foundation | feature | test | integration
Depends on: (none) | TASK-002, TASK-003
Parallelizable: yes | no

**What to build:**
<specific description referencing architecture doc>

**Files to create/modify:**
- `src/foo/bar.ts` — <what this file does>

**Acceptance criteria:**
- <mirrors the relevant FR acceptance criteria>
- <adds implementation-level criteria not in PRD>

**Context for implementer:**
<any ADR decisions that affect this ticket, relevant file structure conventions>
```

**Manifest schema** (TASK-NNN.json):
```json
{
  "ticket_id": "TASK-001",
  "ticket_title": "Implement InvoiceService",
  "requires": {
    "adrs": ["ADR-002", "ADR-005"],
    "existing_files": [
      "src/services/base.ts",
      "src/models/invoice.ts"
    ],
    "interfaces": [
      {
        "name": "IInvoiceRepository",
        "defined_in": "src/interfaces/invoice-repo.ts",
        "why": "InvoiceService depends on this for persistence"
      }
    ],
    "env_vars": ["DATABASE_URL", "PDF_RENDERER_URL"],
    "brief_sections": ["functional-requirements", "non-functional-requirements"],
    "architecture_sections": ["component: InvoiceService", "data-model: Invoice entity"]
  },
  "provides": {
    "new_files": [
      "src/services/invoice.service.ts",
      "tests/services/invoice.service.test.ts"
    ],
    "modified_files": [],
    "exports": [
      {
        "name": "InvoiceService",
        "type": "class",
        "signature": "class InvoiceService implements IInvoiceService"
      },
      {
        "name": "generatePDF",
        "type": "method",
        "signature": "async generatePDF(invoice: Invoice): Promise<Buffer>"
      }
    ]
  },
  "downstream_contracts": {
    "TASK-008": "expects InvoiceService.generatePDF(invoice: Invoice): Promise<Buffer>"
  }
}
```

**System prompt for `claude -p`:**
```
You are a senior engineering lead running in fully automated mode.
You will receive a PRD and architecture document. Break the work into
implementable tickets ordered by dependency.

Rules:
- Each ticket must be implementable by a single focused claude -p call
  (estimate: a ticket that would take a human dev 30min to 2hrs)
- Tickets must be ordered so no ticket depends on an unbuilt ticket above it
- Mark tickets as "parallelizable: yes" only if they truly share no state
- Every ticket must reference specific files from the architecture's file/folder
  structure
- Setup tickets (project init, package.json, tsconfig) come first
- Test tickets come after the implementation tickets they test
- For every ticket, write a context manifest JSON file to
  .autopilot/stages/task-breakdown/manifests/TASK-NNN.json using
  your file-write capability (you have dangerously-skip-permissions)
- Verify that every path in requires.existing_files exists before listing it
- Verify that every ADR in requires.adrs exists before listing it
- Ensure provides.exports declares every symbol that downstream tickets'
  downstream_contracts will reference — verify cross-ticket consistency
- Output ONLY the TASKS.md to .autopilot/stages/task-breakdown/output.md.
  Manifests are written as separate JSON files (not embedded in TASKS.md).
```

**Quality gate checklist (task-breakdown):**
- [ ] Every FR from PRD maps to at least one ticket
- [ ] No circular dependencies between tickets
- [ ] Every ticket references specific files
- [ ] Setup tickets are first
- [ ] Parallelizable tickets have no shared file writes
- [ ] Total ticket count is reasonable (for a small project: 5-20, medium: 20-60)
- [ ] Every ticket has a manifest file at .autopilot/stages/task-breakdown/manifests/TASK-NNN.json — BLOCKER if any ticket is missing one
- [ ] All paths in requires.existing_files of every manifest exist in the repository — BLOCKER if any path is absent
- [ ] All ADRs in requires.adrs of every manifest exist in the ADR directory — BLOCKER if any ADR is missing
- [ ] No circular manifest dependencies (TASK-A's requires references TASK-B's provides.new_files and TASK-B's requires references TASK-A's provides.new_files) — BLOCKER if circular dependency found
- [ ] provides.exports for each ticket is sufficient to satisfy all downstream_contracts that reference that ticket — BLOCKER if signature mismatch found

---

### Stage: developer

**Purpose:** Implement each ticket. This stage runs tickets in parallel where marked
parallelizable.

**Inputs consumed (per ticket):**
- `PROJECT_BRIEF.md`
- `.autopilot/stages/architect/output.md` (architecture)
- `.autopilot/stages/architect/ADRs/` (all ADRs)
- The specific ticket definition from TASKS.md
- All previously implemented files (passed as context or via file reads)

**Outputs produced:**
- Actual source files written to the project directory
- `.autopilot/stages/developer/<ticket-id>/output.md` (implementation notes)

**System prompt for `claude -p` (per ticket):**
```
You are a senior developer running in fully automated mode.
You will receive an architecture document, ADRs, and a single ticket definition.
Implement exactly what the ticket specifies.

Rules:
- Write complete, working code — no placeholders, no "// TODO", no stubs
- Follow the file structure exactly as specified in the architecture document
- Follow the tech stack exactly as specified in PROJECT_BRIEF.md
- If a file already exists (provided in context), modify it — do not recreate
- Every function that contains business logic must have a unit test (unless
  the ticket is a test ticket, in which case write the tests)
- Use the patterns shown in ADRs — do not deviate from decided conventions
- Output: first write all files, then output a brief implementation note
  listing what was created/modified and any edge cases handled
```

**Quality gate checklist (developer — per ticket):**
- [ ] All acceptance criteria from the ticket are met
- [ ] No placeholder code ("TODO", "implement this", empty function bodies)
- [ ] Tests present for business logic (unless this is a non-logic ticket like config)
- [ ] Code follows the patterns from ADRs
- [ ] No imports of packages not in the project's package.json

**Developer quality gate is run per-ticket.** A failing ticket is retried up to 3
times before escalating. Other parallelizable tickets are not blocked by one
ticket's retry.

---

### Stage: reviewer

**Purpose:** Final integration check — run all tests, verify the full project
starts and the happy path works.

**Inputs consumed:**
- Everything in the project directory
- `.autopilot/PIPELINE_STATE.json`
- Definition of done from `PROJECT_BRIEF.md`

**Outputs produced:**
- `.autopilot/stages/reviewer/output.md` (review report)

The reviewer stage actually runs commands:
```bash
# Install dependencies
npm install   # or equivalent

# Run tests
npm test

# Lint
npm run lint

# Start (if applicable) and run smoke test
# (reviewer constructs these based on the brief's definition of done)
```

**System prompt for `claude -p`:**
```
You are a senior QA engineer running in fully automated mode.
You will receive the complete project. Your job:
1. Run all tests and lint
2. Start the application (if applicable)
3. Execute the acceptance criteria from the PROJECT_BRIEF's definition of done
4. Write a review report: what passed, what failed, what needs fixing

If everything passes: output "PIPELINE_COMPLETE" as the first line.
If anything fails: output "PIPELINE_INCOMPLETE", then list specific failures
with file:line references where applicable.
```

**Quality gate checklist (reviewer):**
- [ ] `npm test` (or equivalent) exits 0
- [ ] `npm run lint` exits 0
- [ ] Definition of done from brief is satisfied
- [ ] No TODO comments in production code
- [ ] README or equivalent exists

The reviewer stage has no retry loop — failures here become an ESCALATION
with the full test output attached.

---

## Adding custom stages

To add a stage (e.g. a "security-review" stage between architect and developer):

1. Add an entry to this file following the format above
2. Add it to the stage sequence at the top
3. Update `scripts/run_pipeline.sh` with the new stage name
4. Write its quality gate checklist into `references/quality-gate.md`

The system is designed to be extended — keep the same input/output conventions
and the orchestrator will handle it automatically.
