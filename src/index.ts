import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
import { parseSkill, resolveSkillFile } from "./parse.js";
import { lintSkill } from "./lint.js";
import { auditSkill, loadRules } from "./audit.js";
import { findScenarioFile, loadScenarios, runScenarios } from "./runner.js";
import { buildReport } from "./score.js";
import { getAgent, firstAvailableAgent } from "./agents/index.js";
import type { AgentAdapter, SkillReport } from "./types.js";

export * from "./types.js";
export { parseSkill, resolveSkillFile } from "./parse.js";
export { lintSkill } from "./lint.js";
export { auditSkill, loadRules } from "./audit.js";
export { runScenarios, loadScenarios, findScenarioFile } from "./runner.js";
export { scoreSkill, buildReport, tally } from "./score.js";
export { printReport, renderHtml } from "./report.js";
export { badgeEndpoint, badgeMarkdown } from "./badge.js";
export { listAgents, getAgent, firstAvailableAgent } from "./agents/index.js";

export interface CheckOptions {
  /** Run scenario tests in addition to lint + audit. */
  test?: boolean;
  /** Force a specific agent id; otherwise the first available is used. */
  agentId?: string;
  allowedTools?: string[];
  timeoutMs?: number;
}

/**
 * Discover skills under a path. Accepts a SKILL.md, a skill directory, or a
 * parent directory containing many skills.
 */
export function discoverSkills(input: string): string[] {
  if (!existsSync(input)) return [];
  const direct = resolveSkillFile(input);
  if (direct) return [direct];
  if (statSync(input).isDirectory()) {
    const matches = fg.sync(["**/SKILL.md", "**/Skill.md", "**/skill.md"], {
      cwd: input,
      absolute: true,
      caseSensitiveMatch: false,
      ignore: ["**/node_modules/**"],
    });
    return [...new Set(matches.map((m) => m.split("\\").join("/")))];
  }
  return [];
}

/** Lint + audit (+ optionally test) a single skill, returning its report. */
export async function checkSkill(skillPath: string, options: CheckOptions = {}): Promise<SkillReport> {
  const skill = parseSkill(skillPath);
  const lint = lintSkill(skill);
  const audit = auditSkill(skill, loadRules());

  let scenarios: SkillReport["scenarios"] = [];
  if (options.test) {
    const scenarioFile = findScenarioFile(skill);
    if (scenarioFile) {
      const loaded = loadScenarios(scenarioFile);
      let agent: AgentAdapter | undefined;
      if (options.agentId) agent = getAgent(options.agentId);
      else agent = (await firstAvailableAgent()) ?? getAgent("claude");
      if (agent) {
        scenarios = await runScenarios(skill, loaded, {
          agent,
          allowedTools: options.allowedTools,
          timeoutMs: options.timeoutMs,
        });
      } else {
        // A scenario file exists but no usable agent was resolved — report the
        // scenarios as skipped rather than silently dropping them.
        const why = options.agentId
          ? `agent "${options.agentId}" is not a known adapter`
          : "no agent CLI available";
        scenarios = loaded.map((s) => ({
          scenario: s.name,
          passed: false,
          skipped: true,
          reasons: [why],
          toolsUsed: [],
          output: "",
          durationMs: 0,
        }));
      }
    }
  }

  const name = (skill.frontmatter.name as string) || skill.dir.split(/[/\\]/).pop() || "skill";
  return buildReport(name, skillPath, lint, audit, scenarios);
}

/** Check every skill discovered under a path. */
export async function checkPath(input: string, options: CheckOptions = {}): Promise<SkillReport[]> {
  const skills = discoverSkills(input);
  const reports: SkillReport[] = [];
  for (const s of skills) {
    reports.push(await checkSkill(s, options));
  }
  return reports;
}

export { join };
