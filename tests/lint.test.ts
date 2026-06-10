import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { parseSkill, resolveSkillFile } from "../src/parse.js";
import { lintSkill } from "../src/lint.js";

const fixtures = join(process.cwd(), "fixtures");

function load(name: string) {
  const file = resolveSkillFile(join(fixtures, name));
  assert.ok(file, `fixture ${name} should resolve a SKILL.md`);
  return parseSkill(file);
}

describe("lint", () => {
  it("passes a well-formed skill with no findings", () => {
    assert.deepEqual(lintSkill(load("clean-skill")), []);
  });

  it("flags non-kebab name, short description, missing file, and thin body", () => {
    const ids = lintSkill(load("messy-skill")).map((f) => f.id);
    assert.ok(ids.includes("lint/name-format"), "name-format");
    assert.ok(ids.includes("lint/description-short"), "description-short");
    assert.ok(ids.includes("lint/missing-referenced-file"), "missing-referenced-file");
    assert.ok(ids.includes("lint/body-empty"), "body-empty");
  });

  it("reports a line number for frontmatter findings when available", () => {
    const findings = lintSkill(load("messy-skill"));
    const nameFinding = findings.find((f) => f.id === "lint/name-format");
    assert.ok((nameFinding?.line ?? 0) > 0);
  });
});
