# Contributing to skillci

Thanks for being here. skillci is deliberately designed so there are **three easy ways in**, each with a tiny barrier to entry. Pick whichever fits.

## 1. Add a safety rule (easiest — pure YAML)

Spotted a malicious or risky pattern that skills shouldn't contain? Add a rule.

1. Open [`rules/core.yml`](rules/core.yml) (or add a new `rules/*.yml` pack).
2. Append a rule:
   ```yaml
   - id: audit/your-rule-name
     name: Short human title
     severity: error   # error | warning | info
     target: all       # all | body | frontmatter | scripts
     description: One sentence on why this is dangerous.
     hint: One sentence on what the author should do instead.
     pattern: "your-regex-here"   # matched case-insensitive, multiline
   ```
3. Add a matching line to `fixtures/malicious-skill/SKILL.md` so it's covered, and (if it's subtle) a passing case to `fixtures/clean-skill`.
4. `npm test` — the audit suite checks your rule fires.

Good rules are **specific**: they should catch real attack shapes without flagging legitimate skills. When in doubt, start at `warning`.

## 2. Add an agent adapter (one file)

Want skillci to test skills through Codex, Cursor, Gemini CLI, OpenClaw, etc.? Implement one interface.

1. Create `src/agents/<id>.ts` exporting an `AgentAdapter` (see [`src/types.ts`](src/types.ts) for the contract and [`src/agents/claude.ts`](src/agents/claude.ts) as a reference).
2. Register it in [`src/agents/index.ts`](src/agents/index.ts).
3. The adapter's job: given a skill + scenario, run the agent with the skill's instructions injected and a restricted tool allowlist, then report `{ output, toolsUsed, errored }`.

That's the whole contract. No changes anywhere else.

## 3. Contribute a scenario pack

Pick a popular skill, write `skill.test.yaml` scenarios that pin its behavior, and open a PR adding it under `packs/`. This is how we build a corpus of *tested* skills.

## Dev setup

```bash
npm install
npm run build      # bundle to dist/
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

Dogfood the CLI against the fixtures:

```bash
node dist/cli.js run ./fixtures/clean-skill
node dist/cli.js audit ./fixtures/malicious-skill
```

## Ground rules

- Every new rule or feature comes with a fixture or test.
- Keep `audit` and `lint` dependency-free and execution-free — they must run offline, instantly, on untrusted input.
- Be kind in reviews. First-time contributors are the point of this project.

## Code of Conduct

Be respectful and assume good faith. Harassment isn't tolerated.
