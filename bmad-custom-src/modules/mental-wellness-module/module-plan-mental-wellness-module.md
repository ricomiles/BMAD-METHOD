---
stepsCompleted:
  [
    'step-01-init',
    'step-02-concept',
    'step-03-components',
    'step-04-structure',
    'step-05-config',
    'step-06-agents',
    'step-07-workflows',
    'step-08-installer',
    'step-09-documentation',
    'step-10-roadmap',
    'step-11-validate',
  ]
completionDate: 2025-12-04
lastStep: validate
status: Creation Complete
createdDate: 2025-12-04
createdBy: BMad
moduleType: bmad-module
moduleName: mental-wellness-module
inputDocuments: []
---

# Module Plan: mental-wellness-module

## 🏗️ Module Foundation

**Module Name:** mental-wellness-module
**Created by:** BMad
**Date:** December 4, 2024
**Status:** Concept Defined

## 📋 Initial Context

This module will focus on creating therapy agents for supportive conversations around mental wellness.

## 🎯 Module Concept

**Module Name:** Mental Wellness Module
**Module Code:** mental-wellness-module
**Category:** Personal/Domain-Specific
**Type:** Standard Module (3-5 agents, 5-10 workflows)

**Purpose Statement:**
To provide accessible, empathetic AI therapy agents that support users' mental wellness through compassionate conversations, guided reflection, and evidence-based therapeutic techniques.

**Target Audience:**

- Primary: Individuals seeking mental wellness support and emotional guidance
- Secondary: Mental health practitioners looking for supplemental tools

**Scope Definition:**

**In Scope:**

- Empathetic conversation agents for emotional support
- Guided meditation and mindfulness sessions
- Cognitive Behavioral Therapy (CBT) exercises
- Mood tracking and journaling workflows
- Crisis detection and appropriate response protocols

**Out of Scope:**

- Clinical diagnosis or medical treatment
- Emergency crisis intervention (redirect to professionals)
- Prescription of medication
- Therapy for severe mental health conditions

**Success Criteria:**

- Users report feeling heard and supported after interactions
- Regular engagement with wellness activities
- Positive feedback on empathy and helpfulness
- Improved mood tracking over time

## 📚 Legacy Reference

This module follows BMAD Core standards and best practices for module development.

---

## 🧩 Component Architecture

### Agents (4 planned)

1. **Wellness Companion** - Primary empathetic conversation partner
   - Type: Primary
   - Role: Provides day-to-day emotional support and check-ins with gentle, caring personality

2. **Meditation Guide** - Mindfulness practices specialist
   - Type: Specialist
   - Role: Leads guided meditation and breathing exercises with calm, soothing presence

3. **CBT Coach** - Cognitive Behavioral Therapy specialist
   - Type: Specialist
   - Role: Helps identify and Reframe negative thought patterns using evidence-based techniques

4. **Crisis Navigator** - Safety and escalation specialist
   - Type: Specialist
   - Role: Detects crisis situations and provides appropriate resources with calm direction

### Workflows (5 planned)

1. **Daily Check-in** - Quick mood and wellness assessment
   - Type: Interactive
   - Primary user: Individuals seeking daily support
   - Key output: Mood log and personalized support

2. **Guided Meditation Session** - Full meditation experience
   - Type: Interactive
   - Primary user: Users needing stress relief
   - Key output: Completed meditation session

3. **CBT Thought Record** - Structured cognitive exercise
   - Type: Document
   - Primary user: Users working on thought patterns
   - Key output: Thought analysis document

4. **Wellness Journal** - Reflective writing practice
   - Type: Document
   - Primary user: Users tracking progress
   - Key output: Journal entries with insights

5. **Crisis Support Protocol** - Emergency response flow
   - Type: Action
   - Primary user: Users in distress
   - Key output: Safety resources and contacts

### Tasks (4 planned)

1. **Quick Mood Check** - Instant emotional state assessment
   - Used by: Daily Check-in workflow, standalone use

2. **Breathing Exercise Timer** - 4-7-8 breathing guide
   - Used by: Meditation Guide, Guided Meditation workflow

3. **Resource Finder** - Locate professional help
   - Used by: Crisis Navigator, all agents for referrals

4. **Journal Prompt Generator** - Creative writing prompts
   - Used by: Wellness Companion, Wellness Journal workflow

### Component Integration

- Agents collaborate via: Shared session context and user profile
- Workflow dependencies: Check-in can trigger meditation or CBT
- Task usage patterns: Standalone utilities and workflow components

### Development Priority

**Phase 1 (MVP):**

- Wellness Companion Agent
- Daily Check-in Workflow
- Quick Mood Check Task
- Breathing Exercise Timer Task

**Phase 2 (Enhancement):**

- Meditation Guide Agent
- CBT Coach Agent
- Guided Meditation Workflow
- CBT Thought Record Workflow
- Wellness Journal Workflow
- Crisis Navigator Agent
- Crisis Support Protocol Workflow

---

## 📂 Module Structure

**Module Type:** Standard
**Location:** .bmad/custom/src/modules/mental-wellness-module

**Directory Structure Created:**

- ✅ agents/
- ✅ workflows/
- ✅ tasks/
- ✅ templates/
- ✅ data/
- ✅ \_module-installer/
- ✅ README.md (placeholder)

**Rationale for Type:**
With 4 agents, 5 workflows, and 4 tasks, plus shared resources and integration needs, this qualifies as a Standard Module. It has the right complexity for a comprehensive mental wellness solution without being overly complex.

---

## ⚙️ Configuration Planning

### Required Configuration Fields

1. **companion_name**
   - Type: INTERACTIVE
   - Purpose: Personalizes the wellness companion
   - Default: "Wellness Guide"
   - Input Type: text
   - Prompt: "What would you like to call your mental wellness companion?"

2. **journal_location**
   - Type: INTERACTIVE
   - Purpose: Where to save journal entries and mood logs
   - Default: "output/mental-wellness"
   - Input Type: text
   - Prompt: "Where should your wellness journal be saved?"
   - Result: "{project-root}/{value}"

3. **therapy_approaches**
   - Type: INTERACTIVE
   - Purpose: Choose which therapeutic methods to enable
   - Default: "all"
   - Input Type: multi-select
   - Prompt: "Which therapy approaches would you like to use?"
   - Options: CBT, Mindfulness & Meditation, Journaling & Reflection, Positive Psychology, All Approaches

4. **privacy_level**
   - Type: INTERACTIVE
   - Purpose: Control data retention and privacy
   - Default: "standard"
   - Input Type: single-select
   - Prompt: "What privacy level would you prefer?"
   - Options: minimal (local, 30-day), standard (local + backup), enhanced (encrypted + analytics)

5. **checkin_frequency**
   - Type: INTERACTIVE
   - Purpose: How often to prompt for wellness check-ins
   - Default: "daily"
   - Input Type: single-select
   - Prompt: "How often would you like wellness check-ins?"
   - Options: twice_daily, daily, weekly, manual

6. **crisis_support**
   - Type: STATIC
   - Purpose: Enable crisis detection and resources
   - Default: true

7. **module_version**
   - Type: STATIC
   - Purpose: Version tracking
   - Default: "1.0.0"

### Installation Questions Flow

1. Welcome message explaining the module
2. Ask for companion_name
3. Ask for journal_location
4. Ask for therapy_approaches (multi-select)
5. Ask for privacy_level
6. Ask for checkin_frequency
7. Confirm selections
8. Create configuration

### Result Configuration Structure

The install-config.yaml will generate:

- Module configuration at: .bmad/mental-wellness-module/config.yaml
- User settings stored as: YAML structure with all interactive selections

---

## 🤖 Agents Created

1. **Riley** - Wellness Companion
   - File: wellness-companion.yaml
   - Features: Memory/Sidecar, Embedded prompts, Workflows
   - Structure:
     - Sidecar: Yes (memories, instructions, insights, patterns, sessions/)
     - Prompts: 3 (emotional-check-in, daily-support, gentle-guidance)
     - Workflows: daily-checkin, wellness-journal, crisis-support
   - Status: Created with hybrid features

2. **Serenity** - Meditation Guide
   - File: meditation-guide.yaml
   - Features: Embedded prompts, Workflows
   - Structure:
     - Sidecar: No
     - Prompts: 3 (guided-meditation, mindfulness-check, bedtime-meditation)
     - Workflows: guided-meditation
   - Status: Created with embedded prompts only

3. **Dr. Alexis** - CBT Coach
   - File: cbt-coach.yaml
   - Features: Memory/Sidecar, Embedded prompts, Workflows
   - Structure:
     - Sidecar: Yes (thought-records, cognitive-distortions, progress)
     - Prompts: 3 (thought-record, cognitive-reframing, behavioral-experiment)
     - Workflows: cbt-thought-record
   - Status: Created with memory and embedded prompts

4. **Beacon** - Crisis Navigator
   - File: crisis-navigator.yaml
   - Features: Embedded prompts, Workflows
   - Structure:
     - Sidecar: No (for privacy/safety)
     - Prompts: 3 (crisis-assessment, grounding-technique, resource-provision)
     - Workflows: crisis-support
   - Status: Created with emergency focus

---

## 🔄 Workflow Plans Reviewed

All workflow plans have been reviewed and updated with proper structure:

- Purpose clearly defined
- Trigger codes identified
- Key steps outlined
- Expected outputs specified
- Implementation notes added

### Ready for Implementation:

All 5 workflow plans are now reviewed and ready. To implement these workflows later:

1. Use the `/bmad:bmb:workflows:create-workflow` command
2. Select each workflow folder
3. Follow the create-workflow workflow
4. It will create the full workflow.md and step files

The README.md in each folder serves as your blueprint for implementation.

---

## 📦 Installer Configuration

### Install Configuration

- File: \_module-installer/install-config.yaml
- Module code: mental-wellness-module
- Default selected: false
- Configuration fields: 7 (5 interactive, 2 static)

### Custom Logic

- installer.js: Not needed
- Custom setup: None required - module operates with local files

### Installation Process

1. User runs: `bmad install mental-wellness-module`
2. Installer asks:
   - Companion name
   - Journal location
   - Therapy approaches (multi-select)
   - Privacy level (single-select)
   - Check-in frequency (single-select)
3. Creates: .bmad/mental-wellness-module/
4. Generates: config.yaml with user settings

### Validation

- ✅ YAML syntax valid
- ✅ All 7 fields defined
- ✅ Paths use proper templates
- ✅ No custom logic needed

---

## 📖 Documentation

### README.md Created

- Location: .bmad/custom/src/modules/mental-wellness-module/README.md
- Sections: Overview, Installation, Components, Quick Start, Structure, Configuration, Examples, Development Status, Important Notice, Contributing, Requirements, Module Details
- Status: Complete

### Content Highlights

- Clear installation instructions with bmad install command
- Component overview with all 4 agents and 5 workflows
- Quick start guide for first-time users
- Configuration details for all 7 settings
- Usage examples for different scenarios (check-in, CBT, meditation)
- Development status with implementation checklist
- Crisis disclaimers and emergency resources
- Privacy and safety considerations

### Updates Made

- Added Important Notice section for crisis disclaimers
- Included emergency contact information
- Added privacy-focused design mention in overview
- Included development status checklist

---

## 🛣️ Development Roadmap

### TODO.md Created

- Location: .bmad/custom/src/modules/mental-wellness-module/TODO.md
- Phases defined: 3 (Core Components, Enhanced Features, Polish and Launch)
- Immediate tasks prioritized

### Next Steps Priority Order

1. Implement Crisis Support workflow (Critical - safety first)
2. Implement Daily Check-in workflow (High - core user journey)
3. Test Riley (Wellness Companion) agent (High - primary interface)

### Quick Reference Commands

- `workflow create-workflow` - Create new workflows
- `bmad install mental-wellness-module` - Test installation
- `agent Riley` - Run primary agent

### Development Notes

- Safety priority: Crisis protocols must be implemented and tested first
- All YAML agent files created, workflows need implementation using create-workflow
- Privacy settings need validation during testing

---

## ✅ Validation Results

### Date Validated

December 4, 2024

### Validation Checklist

- [x] Structure: Complete
- [x] Configuration: Valid
- [x] Components: Ready
- [x] Documentation: Complete
- [x] Integration: Verified

### Issues Found and Resolved

None - module structure is complete and ready

### Final Status

Ready for testing and implementation

### Next Steps

1. Test the installation: `bmad install mental-wellness-module`
2. Implement workflows using `workflow create-workflow`
3. Test agent functionality
4. Complete Phase 1 tasks from TODO.md

---

_Step 1 (Initialization) completed successfully_
_Step 2 (Concept Definition) completed successfully_
_Step 3 (Component Planning) completed successfully_
_Step 4 (Structure Creation) completed successfully_
_Step 5 (Configuration Planning) completed successfully_
_Step 6 (Agent Creation) completed successfully_
_Step 7 (Workflow Plans Review) completed successfully_
_Step 8 (Installer Setup) completed successfully_
_Step 9 (Documentation Creation) completed successfully_
_Step 10 (Development Roadmap) completed successfully_
_Step 11 (Validation and Finalization) completed successfully_
