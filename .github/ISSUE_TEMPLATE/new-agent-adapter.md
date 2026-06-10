---
name: "🔌 New agent adapter"
about: Request or volunteer support for testing skills through another agent CLI
title: "[adapter] "
labels: ["agent-adapter", "good first issue"]
---

**Which agent?**
e.g. Codex CLI, Cursor, Gemini CLI, OpenClaw, Aider…

**How does it run headlessly?**
The command and flags for a non-interactive run (the equivalent of `claude -p "..." --output-format stream-json`), and how it reports tool calls if at all.

**Are you up for implementing it?**
It's one file — `src/agents/<id>.ts` implementing the `AgentAdapter` interface, plus one line in `src/agents/index.ts`. See `src/agents/claude.ts` as a reference.
