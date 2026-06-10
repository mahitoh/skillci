---
name: changelog-writer
description: Generates a clean, grouped CHANGELOG entry from a list of git commit messages. Use when the user asks to draft release notes or a changelog from recent commits.
license: MIT
version: 1.0.0
---

# Changelog Writer

Turn raw commit messages into a readable changelog section.

## Procedure

1. Read the commit messages provided by the user (or run `git log --oneline` if asked).
2. Group commits into these sections, skipping any that are empty:
   - **Added** — new features (commits starting with `feat`)
   - **Fixed** — bug fixes (commits starting with `fix`)
   - **Changed** — other user-facing changes
   - **Internal** — chores, refactors, tests (commits starting with `chore`, `refactor`, `test`)
3. Rewrite each entry in the past tense, imperative voice, without the commit prefix.
4. Output a Markdown section headed with the version and today's date.

## Example

Input commits:

```
feat: add dark mode toggle
fix: correct timezone in date picker
chore: bump deps
```

Output:

```markdown
## 1.4.0 — 2026-06-10

### Added
- Dark mode toggle

### Fixed
- Correct timezone in the date picker

### Internal
- Bumped dependencies
```

Keep entries short. Never invent changes that aren't in the commits.
