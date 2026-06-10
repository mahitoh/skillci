import type { Finding, ScenarioResult, SkillReport } from "./types.js";

/** Count findings by severity. */
export function tally(findings: Finding[]) {
  return {
    error: findings.filter((f) => f.severity === "error").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

/**
 * Compute a 0-100 quality score and a verified verdict.
 *
 * Scoring is deliberately simple and transparent:
 *  - start at 100
 *  - each lint/audit error          -25
 *  - each lint/audit warning         -8
 *  - each lint/audit info            -2
 *  - each failed (non-skipped) test -15
 * Skipped tests don't penalize (the agent just wasn't available).
 *
 * "verified" requires: zero errors, and — if any tests actually ran — all of
 * them passing. A skill with no executed tests can still be verified on the
 * static checks alone, but the report makes the distinction explicit.
 */
export function scoreSkill(
  lint: Finding[],
  audit: Finding[],
  scenarios: ScenarioResult[]
): { score: number; verified: boolean } {
  const findings = [...lint, ...audit];
  let score = 100;
  for (const f of findings) {
    score -= f.severity === "error" ? 25 : f.severity === "warning" ? 8 : 2;
  }
  const ran = scenarios.filter((s) => !s.skipped);
  const failed = ran.filter((s) => !s.passed);
  score -= failed.length * 15;
  score = Math.max(0, Math.min(100, score));

  const hasError = findings.some((f) => f.severity === "error");
  const verified = !hasError && failed.length === 0;
  return { score, verified };
}

export function buildReport(
  skillName: string,
  skillPath: string,
  lint: Finding[],
  audit: Finding[],
  scenarios: ScenarioResult[]
): SkillReport {
  const { score, verified } = scoreSkill(lint, audit, scenarios);
  return { skillName, skillPath, lint, audit, scenarios, score, verified };
}
