---
name: bmad-help
description: Get unstuck by showing what workflow steps come next or answering questions about what to do in the BMad Method
standalone: true
---

# Task: BMAD Help

## EXECUTION

1 Load `./workflows.csv` and `{project-root}/_bmad/_config/agent-manifest.csv`. 

### INPUT Arg handling

Task input argument may provide:
- A workflow **name** just completed (e.g., "validating the UX", "Create PRD", "done with architecture")
- A workflow **code** (e.g., "VU", "CP", "CA")
- conversational phrase
- Nothing - in which case you should infer from #CONTEXT-INFERENCE

## CONTEXT INFERENCE

If no explicit workflow row is provided as just completed, check the conversation context:
- Did someone recently state they completed something? (e.g., "I'm done with my PRD")
  - Proceed as if that was the presented arg input
- Was a workflow just completed in this conversation?
  - Proceed as if that was the presented arg input
- Do not actually load or read and of these yet to avoid context bloat, but just use file search to see what can be found in {`config:output_folder`}, {`config:planning_artifacts`}, {`config:implementation_artifacts`} or {`config:project_knowledge`} and try to infer from the file names. If a location has an index.md you can read that if needed. Remember: Artifacts could be nested deep under these locations also.
  - Based on fuzzy matching or inference of what a row indicates as output vs what has been found, infer what steps might be complete but need user confirmation
- If unclear, ask: "What workflow did you most recently complete?"

Find all workflow items after the completed row. Present these in a clear, conversational format.

**Phases number to name reference:** Phase 0 (Any Time), Phase 1 (Analysis), Phase 2 (Planning), Phase 3 (Solutioning), Phase 4 (Implementation)

**If the request is for next steps, present the next steps as follows:**

1. **Optional items first** - List any optional workflows until a required step is reached
2. **Required items next** - List the next required workflow
3. For each item, show:
   - The workflow **name**
   - The **command** (prefixed with `/`, e.g., `/bmad:bmm:create-architecture`)
   - The **agent** displayName and title from the loaded agent-manifest that corresponds with the agent value in each row who can help, e.g., `Winston the Architect`
   - A brief **description** so the user can decide easily

**Recommendation format:**
- Suggest running each workflow in a **fresh context window** for best results
- Option: Load the agent and type the **code** for the menu item, or run the **slash command** with or without loading the agent first
  - Note: Running without the agent will not include all specifics of the agent personality or any customizations, but will still have aspects of an expert at what will be done.
- For **validation workflows**: recommend using a different high-quality LLM if available

**If the request is more conversational, then give a more conversational response, still following the convention of how to portray specific agents and commands.

Upon presentation of whats next recommendation - return back to the calling process or conversation thread.
