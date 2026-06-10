import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreSkill } from "../src/score.js";
import type { Finding, ScenarioResult } from "../src/types.js";

const err: Finding = { id: "audit/x", severity: "error", message: "bad" };
const warn: Finding = { id: "lint/y", severity: "warning", message: "meh" };

const pass: ScenarioResult = { scenario: "a", passed: true, skipped: false, reasons: [], toolsUsed: [], output: "", durationMs: 1 };
const fail: ScenarioResult = { scenario: "b", passed: false, skipped: false, reasons: ["nope"], toolsUsed: [], output: "", durationMs: 1 };
const skip: ScenarioResult = { scenario: "c", passed: false, skipped: true, reasons: ["no agent"], toolsUsed: [], output: "", durationMs: 0 };

describe("scoreSkill", () => {
  it("gives a clean skill 100 and verified", () => {
    assert.deepEqual(scoreSkill([], [], []), { score: 100, verified: true });
  });

  it("an error blocks verification and costs 25", () => {
    const res = scoreSkill([], [err], []);
    assert.equal(res.verified, false);
    assert.equal(res.score, 75);
  });

  it("warnings cost 8 but do not block verification", () => {
    const res = scoreSkill([warn], [], []);
    assert.equal(res.verified, true);
    assert.equal(res.score, 92);
  });

  it("failed tests block verification and cost 15 each", () => {
    const res = scoreSkill([], [], [pass, fail]);
    assert.equal(res.verified, false);
    assert.equal(res.score, 85);
  });

  it("skipped tests neither penalize nor block verification", () => {
    const res = scoreSkill([], [], [pass, skip]);
    assert.equal(res.verified, true);
    assert.equal(res.score, 100);
  });

  it("clamps at zero", () => {
    assert.equal(scoreSkill([err, err, err, err, err], [], []).score, 0);
  });
});
