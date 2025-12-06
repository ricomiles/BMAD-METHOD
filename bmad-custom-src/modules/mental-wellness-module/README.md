# Mental Wellness Module

To provide accessible, empathetic AI therapy agents that support users' mental wellness through compassionate conversations, guided reflection, and evidence-based therapeutic techniques.

## Overview

This module provides:

- **4 Specialized Agents** for different aspects of mental wellness support
- **5 Evidence-Based Workflows** for structured wellness practices
- **Quick Support Tasks** for immediate help and grounding
- **Privacy-Focused Design** with configurable data retention
- **Crisis Support Resources** with appropriate escalation protocols

## Installation

Install the module using BMAD:

```bash
bmad install mental-wellness-module
```

## Components

### Agents (4)

1. **Riley (Wellness Companion)** 🌱 - Primary empathetic support agent for daily emotional wellness conversations
2. **Serenity (Meditation Guide)** 🧘 - Specialized agent for mindfulness practices and guided meditation sessions
3. **Dr. Alexis (CBT Coach)** 🧠 - Cognitive Behavioral Therapy specialist for thought work and behavioral exercises
4. **Beacon (Crisis Navigator)** 🆘 - Emergency response agent providing immediate resources and support

### Workflows (5)

1. **Daily Check-in** (DC) - Quick mood and wellness assessment with personalized support
2. **Wellness Journal** (WJ) - Guided reflective writing practice with mood tracking
3. **Guided Meditation** (GM) - Full meditation sessions with various techniques and durations
4. **CBT Thought Record** (TR) - Structured cognitive exercise for challenging negative thought patterns
5. **Crisis Support** - Emergency response protocol with resources and escalation

### Tasks (4)

1. **Quick Mood Check** - Instant emotional state assessment
2. **Breathing Exercise Timer** - 4-7-8 breathing guide for immediate calm
3. **Resource Finder** - Locate professional mental health help
4. **Journal Prompt Generator** - Creative prompts for reflective writing

## Quick Start

1. **Load the primary agent:**

   ```
   agent Riley
   ```

2. **View available commands:**

   ```
   *help
   ```

3. **Run your first check-in:**

   ```
   daily-checkin
   ```

## Module Structure

```
mental-wellness-module/
├── agents/                    # Agent definitions
│   ├── wellness-companion.yaml
│   ├── meditation-guide.yaml
│   ├── cbt-coach.yaml
│   └── crisis-navigator.yaml
├── workflows/                 # Workflow folders
│   ├── daily-checkin/
│   │   └── README.md
│   ├── wellness-journal/
│   │   └── README.md
│   ├── guided-meditation/
│   │   └── README.md
│   ├── cbt-thought-record/
│   │   └── README.md
│   └── crisis-support/
│       └── README.md
├── tasks/                     # Task files (planned)
├── templates/                 # Shared templates (planned)
├── data/                      # Module data
├── _module-installer/         # Installation config
│   └── install-config.yaml
├── module-plan-mental-wellness-module.md
└── README.md                  # This file
```

## Configuration

The module can be configured in `.bmad/mental-wellness-module/config.yaml`

**Key Settings:**

- **companion_name**: Personalizes your wellness companion (default: "Wellness Guide")
- **journal_location**: Where wellness journal entries are saved
- **therapy_approaches**: Choose therapeutic methods (CBT, Mindfulness, Journaling, Positive Psychology)
- **privacy_level**: Control data retention (minimal, standard, enhanced)
- **checkin_frequency**: How often to prompt for wellness check-ins
- **crisis_support**: Enable crisis detection and resources (enabled by default)

## Examples

### Example 1: Daily Wellness Check-in

```
agent Riley
DC
> How are you feeling today? [1-10]
> What's one positive moment from today?
> Any challenges you'd like support with?
```

### Example 2: Anxiety Management with CBT

```
agent "Dr. Alexis"
TR
> Let's work through a thought record...
> What was the situation?
> What automatic thoughts occurred?
> Let's identify cognitive distortions...
```

### Example 3: Quick Stress Relief

```
agent Serenity
BR
> Follow along: Inhale for 4...
> Hold for 7...
> Exhale for 8...
> Repeat 3 times...
```

## Development Status

This module is currently:

- [x] Structure created
- [x] Agents implemented (YAML files created)
- [x] Installer configured
- [ ] Workflows implemented (README plans created)
- [ ] Tasks implemented
- [ ] Full testing complete

**Note:** Workflows are planned and documented but require implementation using the `create-workflow` workflow.

## Important Notice

**This module is not a substitute for professional mental health care.** It provides:

- Supportive companionship and conversation
- Evidence-based wellness techniques
- Educational content about mental health
- Resources for professional help

**For emergencies, contact:**

- Crisis Text Line: Text HOME to 741741
- National Suicide Prevention Lifeline: Call or text 988
- Local emergency services: Call 911

## Contributing

To extend this module:

1. Add new agents using `create-agent` workflow
2. Implement workflows using `create-workflow` workflow
3. Update the installer configuration if needed
4. Test thoroughly
5. Ensure all crisis protocols remain intact

## Requirements

- BMAD Method version 6.0.0 or higher
- No external dependencies

## Author

Created by BMad on December 4, 2024

## License

[Add license information if applicable]

---

## Module Details

**Module Code:** mental-wellness-module
**Category:** Personal/Domain-Specific
**Type:** Standard Module
**Version:** 1.0.0

**Last Updated:** December 4, 2024
