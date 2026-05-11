# PROJECT_BRIEF.md — Schema and Validation Rules

The brief is the only human input to the pipeline. It must be rich enough that
no downstream stage ever hits an ambiguous fork — because there's no human to
ask. Every clarifying question you'd normally ask mid-pipeline should be answered
here upfront.

---

## Required sections

### 1. Project overview
One paragraph. What is being built, for whom, and why. Should answer:
- What problem does this solve?
- Who uses it?
- What does success look like in concrete terms?

### 2. Core features (explicit scope)
A list of features that are IN scope for this run. Be specific — not "user auth"
but "email + password login, JWT sessions, password reset via email, no OAuth".

Also list what is explicitly OUT of scope. Ambiguity about scope is the #1 cause
of quality gate failures.

### 3. Tech stack
Explicit decisions:
- Language + runtime (e.g. "TypeScript, Node 20, ESM")
- Framework (e.g. "Fastify for API, React 18 + Vite for frontend")
- Database (e.g. "PostgreSQL 15, Drizzle ORM")
- Infrastructure (e.g. "Docker Compose for local, Railway for deploy")
- Testing (e.g. "Vitest for unit, Playwright for e2e")

If you write "use whatever makes sense", the architect stage will make those
decisions — but it will have to make them without you, so they'll reflect the
model's defaults, not your preferences.

### 4. Quality bar
What does "done" mean for this run?
- Test coverage expectation (e.g. "unit tests for all business logic, no coverage % required")
- Linting/formatting (e.g. "ESLint + Prettier, must pass on CI")
- Performance (e.g. "API p95 < 200ms under 100 concurrent users")
- Security (e.g. "OWASP Top 10 considered, no auth bypass")

### 5. Constraints and non-negotiables
Things the pipeline must not deviate from:
- File/folder structure conventions you care about
- Naming conventions
- External services that must or must not be used
- Budget/API cost limits if relevant

### 6. Definition of done
How the pipeline knows the run is complete. Can be as simple as:
"All features listed in core features are implemented, tests pass, app starts and
the happy path works end-to-end."

Or more specific:
"Postman collection in /docs/api.json hits every endpoint and gets expected
responses. Docker Compose up starts without errors."

---

## Optional but strongly recommended

### Context: existing codebase
If adding to an existing project, describe:
- Current folder structure (paste `tree -L 2`)
- Existing patterns to follow (e.g. "all API routes use Zod for validation")
- Things to avoid touching

### Context: prior decisions
Any architecture decision records (ADRs), tech choices, or past postmortems that
should inform how the pipeline approaches decisions.

### Persona / tone (for docs)
If the pipeline will generate user-facing docs or READMEs, describe the voice.

---

## Validation rules (run by validate_brief.py)

The script checks the brief against these rules and prints a report. The pipeline
will not start if any BLOCKING rule fails.

### BLOCKING — pipeline will not start without these
- [ ] Project overview present (> 50 words)
- [ ] At least 3 core features listed
- [ ] Tech stack: language + framework specified
- [ ] Tech stack: database specified OR "no database" explicitly stated
- [ ] Definition of done present
- [ ] No placeholder text (strings like "TODO", "TBD", "to be decided")

### WARNING — pipeline will start but expect quality gate failures
- [ ] Out-of-scope features not listed (architect may gold-plate)
- [ ] Quality bar not specified (gate will use conservative defaults)
- [ ] No testing preference (will default to "unit tests for pure functions")
- [ ] Constraints/non-negotiables not listed

---

## Example brief (minimal but valid)

```markdown
# Project: Invoice CLI

## Overview
A command-line tool for freelancers to generate PDF invoices from YAML config
files. The user runs `invoice generate invoice.yml` and gets a PDF in the same
folder. No UI, no database, no server. Target user: solo developers who want
to automate billing without learning accounting software.

## Core features
IN scope:
- Parse invoice YAML (client info, line items, rates, tax %)
- Generate PDF via Puppeteer (HTML template → PDF)
- Support multiple templates (stored in ~/.invoice/templates/)
- CLI: `invoice generate <file>`, `invoice template list`, `invoice template add <name> <path>`

OUT of scope: recurring invoices, payment tracking, cloud sync, GUI

## Tech stack
- TypeScript, Node 20, ESM modules
- Commander.js for CLI
- Puppeteer for PDF generation
- Zod for YAML validation
- Vitest for tests
- No database (config files only)

## Quality bar
- Unit tests for YAML parsing and tax calculation logic
- E2E test: generate PDF from fixture YAML, assert file exists and is > 1KB
- ESLint must pass
- No external network calls at runtime (Puppeteer in no-sandbox local mode)

## Constraints
- Output PDF must be < 500KB for a typical 5-line-item invoice
- Templates use Handlebars syntax (must be compatible with hbs npm package)
- CLI must work on macOS and Linux (no Windows support required)

## Definition of done
`npm test` passes. `node dist/cli.js generate fixtures/sample.yml` produces
`fixtures/sample.pdf` that opens in Preview.
```

---

## Ideation → Brief checklist

When helping the user write the brief during ideation, work through this:

1. "What are you building?" → overview
2. "List everything it needs to do" → features; then explicitly ask "what should
   it NOT do in this version?"
3. "Any tech preferences or constraints?" → stack; push for specifics
4. "How will you know it's done?" → definition of done
5. "Anything I absolutely must not touch or change?" → constraints

The goal is to get to a brief where, if you read it cold with no other context,
you could build exactly what the user has in mind with no follow-up questions.
