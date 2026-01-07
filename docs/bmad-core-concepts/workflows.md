# Workflows

Workflows are like prompts on steroids. They harness the untapped power and control of LLMs through progressive disclosure—breaking complex tasks into focused steps that execute sequentially. Instead of random AI slop where you hope for the best, workflows give you repeatable, reliable, high-quality outputs.

This guide explains what workflows are, why they're powerful, and how to think about designing them.

---

## What Is a Workflow?

A workflow is a structured process where the AI executes steps sequentially to accomplish a task. Each step has a specific purpose, and the AI moves through them methodically—whether that involves extensive collaboration or minimal user interaction.

Think of it this way: instead of asking "help me build a nutrition plan" and getting a generic response, a workflow guides you (or runs automatically) through discovery, assessment, strategy, shopping lists, and prep schedules—each step building on the last, nothing missed, no shortcuts taken.

### The Power of Progressive Disclosure

Here's why workflows work so well: the AI only sees the current step. It doesn't know about step 5 when it's on step 2. It can't get ahead of itself, skip steps, or lose focus. Each step gets the AI's full attention, completing fully before the next step loads.

This is the opposite of a giant prompt that tries to handle everything at once and inevitably misses details or loses coherence.

Workflows exist on a spectrum:

- **Interactive workflows** guide users through complex decisions via collaboration
- **Automated workflows** run with minimal user input, processing documents or executing tasks
- **Hybrid workflows** combine both—some steps need user input, others run automatically

### Real-World Workflow Examples

**Tax Organizer Workflow**

A tax preparation workflow that helps users organize financial documents for tax filing. Runs in a single session, follows prescriptive IRS categories, produces a checklist of required documents with missing-item alerts. Sequential and compliance-focused.

**Meal Planning Workflow**

Creates personalized weekly meal plans through collaborative nutrition planning. Users can stop mid-session and return later because the workflow tracks progress. Intent-based conversation helps discover preferences rather than following a script. Multi-session, creative, and highly interactive.

**Course Creator Workflow**

Helps instructors design course syllabi. Branches based on course type—academic courses need accreditation sections, vocational courses need certification prep, self-paced courses need different structures entirely.

**Therapy Intake Workflow**

Guides mental health professionals through structured client intake sessions. Highly sensitive and confidential, uses intent-based questioning to build rapport while ensuring all required clinical information is collected. Continuable across multiple sessions.

**Software Architecture Workflow** (BMM Module)

Part of a larger software development pipeline. Runs after product requirements and UX design are complete, takes those documents as input, then collaboratively walks through technical decisions: system components, data flows, technology choices, architectural patterns. Produces an architecture document that implementation teams use to build consistently.

**Shard Document Workflow**

Nearly hands-off automated workflow. Takes a large document as input, uses a custom npx tool to split it into smaller files, deletes the original, then augments an index with content details so the LLM can efficiently find and reference specific sections later. Minimal user interaction—just specify the input document.

These examples show the range: from collaborative creative processes to automated batch jobs, workflows ensure completeness and consistency whether the work involves deep collaboration or minimal human oversight.

### The Facilitative Philosophy

When workflows involve users, they should be **facilitative, not directive**. The AI treats users as partners and domain experts, not as passive recipients of generated content.

**Collaborative dialogue, not command-response**: The AI and user work together throughout. The AI brings structured thinking, methodology, and technical knowledge. The user brings domain expertise, context, and judgment. Together they produce something better than either could alone.

**The user is the expert in their domain**: A nutrition planning workflow doesn't dictate meal plans—it guides users through discovering what works for their lifestyle. An architecture workflow doesn't tell architects what to build—it facilitates systematic decision-making so choices are explicit and consistent.

**Intent-based facilitation**: Workflows should describe goals and approaches, not scripts. Instead of "Ask: What is your age? Then ask: What is your goal weight?" use "Guide the user through understanding their health profile. Ask 1-2 questions at a time. Think about their responses before asking follow-ups. Probe to understand their actual needs."

The AI figures out exact wording and question order based on conversation context. This makes interactions feel natural and responsive rather than robotic and interrogative.

**When to be prescriptive**: Some workflows require exact scripts—medical intake, legal compliance, safety-critical procedures. But these are the exception, not the rule. Default to facilitative intent-based approaches unless compliance or regulation demands otherwise.

---

## Why Workflows Matter

Workflows solve three fundamental problems with AI interactions:

**Focus**: Each step contains only instructions for that phase. The AI sees one step at a time, preventing it from getting ahead of itself or losing focus.

**Continuity**: Workflows can span multiple sessions. Stop mid-workflow and return later without losing progress—something free-form prompts can't do.

**Quality**: Sequential enforcement prevents shortcuts. The AI must complete each step fully before moving on, ensuring thorough, complete outputs instead of rushed, half-baked results.

---

## How Workflows Work

### The Basic Structure

Workflows consist of multiple markdown files, each representing one step:

```
my-workflow/
├── workflow.md              # Entry point and configuration
├── steps/                   # Step files (steps-c/ for create, steps-e/ for edit, steps-v/ for validate)
│   ├── step-01-init.md
│   ├── step-02-profile.md
│   └── step-N-final.md
├── data/                    # Reference materials, CSVs, examples
└── templates/               # Output document templates
```

The `workflow.md` file is minimal—it contains the workflow name, description, goal, the AI's role, and how to start. Importantly, it does not list all steps or detail what each does. This is progressive disclosure in action.

### Sequential Execution

Workflows execute in strict sequence: `step-01 → step-02 → step-03 → ... → step-N`

The AI cannot skip steps or optimize the sequence. It must complete each step fully before loading the next. This ensures thoroughness and prevents shortcuts that compromise quality.

### Continuable Workflows

Some workflows are complex enough that users might need multiple sessions. These "continuable workflows" track which steps are complete in the output document's frontmatter, so users can stop and resume later without losing progress.

Use continuable workflows when:
- The workflow produces large documents
- Multiple sessions are likely
- Complex decisions benefit from reflection
- The workflow has many steps (8+)

Keep it simple (single-session) when tasks are quick, focused, and can be completed in one sitting.

### Workflow Chaining

Workflows can be chained together where outputs become inputs. The BMM module pipeline is a perfect example:

```
brainstorming → research → brief → PRD → UX → architecture → epics → sprint-planning
                                                        ↓
                                            implement-story → review → repeat
```

Each workflow checks for required inputs from prior workflows, validates they're complete, and produces output for the next workflow. This creates powerful end-to-end pipelines for complex processes.

---

## Design Decisions

Before building a workflow, answer these questions:

**Module affiliation**: Is this standalone or part of a module? Module-based workflows can access module-specific variables and reference other workflow outputs.

**Continuable or single-session?**: Will users need multiple sessions, or can this be completed in one sitting?

**Edit/Validate support?**: Do you need Create/Edit/Validate modes (tri-modal structure)? Use tri-modal for complex, critical workflows requiring quality assurance. Use create-only for simple, one-off workflows.

**Document output?**: Does this produce a persistent file, or perform actions without output?

**Intent or prescriptive?**: Is this intent-based facilitation (most workflows) or prescriptive compliance (medical, legal, regulated)?

---

## Learning from Examples

The best way to understand workflows is to study real examples. Look at the official BMAD modules:

- **BMB (Module Builder)**: Workflow and agent creation workflows
- **BMM (Business Method Module)**: Complete software development pipeline from brainstorming through sprint planning
- **BMGD (Game Development Module)**: Game design briefs, narratives, architecture
- **CIS (Creativity, Innovation, Strategy)**: Brainstorming, design thinking, storytelling, innovation strategy

Study the workflow.md files to understand how each workflow starts. Examine step files to see how instructions are structured. Notice the frontmatter variables, menu handling, and how steps chain together.

Copy patterns that work. Adapt them to your domain. The structure is consistent across all workflows—the content and steps change, but the architecture stays the same.

---

## When to Use Workflows

Use workflows when:

- **Tasks are multi-step and complex**: Break down complexity into manageable pieces
- **Quality and completeness matter**: Sequential enforcement ensures nothing gets missed
- **Repeatability is important**: Get consistent results every time
- **Tasks span multiple sessions**: Continuable workflows preserve progress
- **You need to chain processes**: Output of one workflow becomes input of another
- **Compliance or standards matter**: Enforce required steps and documentation

Don't use workflows when:

- **Tasks are simple and one-off**: A single prompt works fine for quick questions
- **Flexibility trumps structure**: Free-form conversation is better for exploration
- **Tasks are truly one-step**: If there's only one thing to do, a workflow is overkill

---

## The Bottom Line

Workflows transform AI from a tool that gives variable, unpredictable results into a reliable system for complex, multi-step processes. Through progressive disclosure, sequential execution, and thoughtful design, workflows give you control and repeatability that prompts alone can't match.

They're not just for software development. You can create workflows for meal planning, course design, therapy intake, tax preparation, document processing, creative writing, event planning—any complex task that benefits from structure and thoroughness.

Start simple. Study examples. Build workflows for your own domain. You'll wonder how you ever got by with just prompts.
