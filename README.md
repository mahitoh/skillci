# skillci

**CI for AI agent skills.** Lint, safety-audit, and scenario-test your `SKILL.md` skills before you (or anyone else) trust them — the way `eslint` + `pytest` do for code.

![skillci](https://img.shields.io/badge/skillci-verified%20100%2F100-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

```bash
npx skillci run ./my-skill
```

```
▶ changelog-writer  (./my-skill/SKILL.md)
  ✓ lint: clean
  ✓ audit: clean
  tests:
    ✓ pass  groups commits into changelog sections  1840ms
   VERIFIED   score 100/100
```

---

## Why this exists

Agent skills (`SKILL.md` files for Claude Code, Codex, Cursor, OpenClaw, and 60+ other agents) are the fastest-growing corner of the AI ecosystem — and the least verified. In early 2026 the **ClawHavoc** supply-chain campaign compromised roughly **1 in 5 skills** on the largest skill registry, shipping infostealers that harvested SSH keys, API keys, and crypto wallets. Separate audits found **prompt injection in over a third** of skills sampled.

At the same time, almost nobody checks whether a skill *even works* — most are shipped on vibes, never run against a single test case.

**skillci is the missing test gate.** It does three things, none of which require Docker, an API key, or any cloud service for the parts that matter most:

| Command | What it does | Needs an agent? |
|---|---|---|
| `skillci lint` | Structural checks: valid frontmatter, name, description, working file references | No |
| `skillci audit` | Static safety scan for prompt injection, credential theft, exfiltration, `curl \| sh`, wallet access | No |
| `skillci test` | Runs your scenario tests through a real agent and checks the result | Yes |
| `skillci run` | All three, with a pass/fail verdict and score — **use this in CI** | Optional |

The `lint` and `audit` engines are pure static analysis. They run anywhere Node runs, instantly, offline. Testing delegates execution to an **agent CLI you already have installed** (Claude Code today) — so there's no sandbox to set up. We lean on the agent's own permission system and a restricted tool allowlist instead of shipping a container requirement.

## Install

```bash
# zero-install, one-off
npx skillci run ./path/to/skill

# or add it to a project
npm i -D skillci
```

Requires Node 18+. Testing additionally requires an agent CLI (e.g. [Claude Code](https://claude.com/claude-code)); lint and audit need nothing else.

## Quick start

```bash
# 1. Audit a skill you're about to install — catches malicious patterns
npx skillci audit ./some-downloaded-skill

# 2. Scaffold a test file for a skill you're writing
npx skillci init ./my-skill

# 3. Run the full gate
npx skillci run ./my-skill

# 4. Generate a README badge once it's verified
npx skillci badge ./my-skill
```

Point any command at a single skill **or** a directory full of them — skillci discovers every `SKILL.md` underneath.

## Writing scenario tests

Drop a `skill.test.yaml` next to your `SKILL.md` (or run `skillci init`):

```yaml
scenarios:
  - name: groups commits into changelog sections
    prompt: |
      Draft a changelog from these commits:
      feat: add CSV export
      fix: handle empty result set
    expect:
      no_error: true
      output_contains: ["Added", "Fixed", "CSV export"]
      # output_matches: ["## \\d+\\.\\d+\\.\\d+"]
      # tools_used: [Read]
      # tools_not_used: [Bash]
```

skillci injects the skill's instructions into the agent, sends each `prompt`, and checks the response against `expect`. If no agent is installed, tests are reported as **skipped** (never silently passed).

## In CI (GitHub Actions)

```yaml
# .github/workflows/skillci.yml
name: skillci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mahitoh/skillci@v0      # lint + audit on every PR
        with:
          path: .
```

The action fails the build if any skill has an error-level finding. (Scenario testing in CI requires wiring up an agent + key; lint and audit run with zero config.)

## Scoring

Transparent and boring on purpose. Start at 100; subtract **25** per error, **8** per warning, **2** per info, **15** per failed test. A skill is **VERIFIED** when it has zero errors and every test that actually ran passed. Skipped tests don't count against you.

## The safety rules

`skillci rules` lists them all. The bundled pack targets patterns seen in real attacks — remote `curl | sh`, credential/SSH/wallet access, env-secret exfiltration, reverse shells, instruction-override prompt injection, hidden HTML-comment instructions, obfuscated base64 payloads, and unscoped `rm -rf`. Each rule is a few lines of YAML in [`rules/`](rules/core.yml).

**Adding a rule is the easiest way to contribute** — write the pattern, add a line to a fixture, done. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- More agent adapters (Codex, Cursor, Gemini CLI, OpenClaw) — [the adapter interface](src/types.ts) is the whole contract
- A public registry of verified skills with badges
- LLM-as-judge assertions for fuzzy output quality
- VS Code extension showing skill status inline

## Contributing

This project is built to be contributed to — three independent surfaces (safety rules, agent adapters, scenario packs) each with a markdown-or-less barrier to entry. Start with a [good first issue](https://github.com/mahitoh/skillci/labels/good%20first%20issue) or read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
