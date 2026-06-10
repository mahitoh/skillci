import type { SkillReport } from "./types.js";

/**
 * Produce a shields.io-style endpoint JSON object describing a skill's status.
 * Authors can wire this to https://img.shields.io/endpoint?url=... or just use
 * the static markdown from `badgeMarkdown`.
 */
export function badgeEndpoint(report: SkillReport) {
  return {
    schemaVersion: 1,
    label: "skillci",
    message: report.verified ? `verified ${report.score}/100` : `failing ${report.score}/100`,
    color: report.verified ? "brightgreen" : report.score >= 50 ? "yellow" : "red",
  };
}

/** A static shields.io badge URL + markdown snippet for a README. */
export function badgeMarkdown(report: SkillReport): string {
  const status = report.verified ? "verified" : "failing";
  const color = report.verified ? "brightgreen" : report.score >= 50 ? "yellow" : "red";
  const msg = encodeURIComponent(`${status} ${report.score}/100`);
  const url = `https://img.shields.io/badge/skillci-${msg}-${color}`;
  return `![skillci](${url})`;
}
