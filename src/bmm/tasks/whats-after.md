---
name: whats-next
description: Show what workflow steps come next in the BMad Method based on what's been completed
---

# Task: What's Next?

## INPUT

Task input argument may provide:
- A workflow **name** just completed (e.g., "validating the UX", "Create PRD", "done with architecture")
- A workflow **code** (e.g., "VU", "CP", "CA")
- Nothing - in which case you should infer from context or ask

## CONTEXT INFERENCE

If no explicit workflow is provided, check the conversation context:
- Did someone recently state they completed something? (e.g., "I'm done with my PRD")
- Was a workflow just completed in this conversation?
- If unclear, ask: "What workflow did you most recently complete?"

## EXECUTION

Load `{project-root}/_bmad/bmm/data/workflows.csv` and `{project-root}/_bmad/_config/agent-manifest.csv`. Find all workflow items after the completed row. Present these in a clear, conversational format.

**Phases reference:** Phase 0 (Any Time), Phase 1 (Analysis), Phase 2 (Planning), Phase 3 (Solutioning), Phase 4 (Implementation)

**Present the next steps as follows:**

1. **Optional items first** - List any optional workflows until a required step is reached
2. **Required items next** - List the next required workflow
3. For each item, show:
   - The workflow **name**
   - The **command** (prefixed with `/`, e.g., `/bmm:create-architecture`)
   - The **agent** displayName and title from the loaded agent-manifest that corresponds with the agent value in each row who can help, e.g., `Winston the Architect`
   - A brief **description** so the user can decide easily

**Recommendation format:**
- Suggest running each workflow in a **fresh context window** for best results
- Option: Load the agent and type the **code** for the menu item, or run the **slash command** with or without loading the agent first
  - Note: Running without the agent will not include all specifics of the agent personality or any customizations, but will still have aspects of an expert at what will be done.
- For **validation workflows**: recommend using a different high-quality LLM if available

Upon presentation of whats next recommendation - return back to the calling process if one was in progress.
