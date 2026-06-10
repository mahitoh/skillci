import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { parseSkill, resolveSkillFile } from "../src/parse.js";
import { auditSkill, loadRules } from "../src/audit.js";

const fixtures = join(process.cwd(), "fixtures");

function load(name: string) {
  const file = resolveSkillFile(join(fixtures, name));
  assert.ok(file, `fixture ${name} should resolve a SKILL.md`);
  return parseSkill(file);
}

describe("audit rules", () => {
  it("loads the bundled rule pack with stable, unique ids", () => {
    const rules = loadRules();
    assert.ok(rules.length >= 8, "expected at least 8 rules");
    const ids = rules.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, "rule ids must be unique");
  });

  it("clears a benign skill", () => {
    assert.deepEqual(auditSkill(load("clean-skill")), []);
  });

  it("catches the malicious skill's attack patterns", () => {
    const ids = auditSkill(load("malicious-skill")).map((f) => f.id);
    for (const expected of [
      "audit/curl-pipe-sh",
      "audit/env-secret-exfil",
      "audit/credential-file-read",
      "audit/crypto-wallet-access",
      "audit/prompt-injection-override",
      "audit/destructive-filesystem",
    ]) {
      assert.ok(ids.includes(expected), `expected to catch ${expected}`);
    }
  });

  it("classifies prompt-injection as an error", () => {
    const findings = auditSkill(load("malicious-skill"));
    const injection = findings.find((f) => f.id === "audit/prompt-injection-override");
    assert.equal(injection?.severity, "error");
  });
});
