import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  ScenarioFileSchema,
  type AgentAdapter,
  type ParsedSkill,
  type Scenario,
  type ScenarioResult,
} from "./types.js";

/** Default tools a skill under test is allowed to use. Conservative on purpose. */
const DEFAULT_ALLOWED_TOOLS = ["Read", "Grep", "Glob", "Bash"];

/** Locate the scenario file for a skill (skill.test.yaml / tests.yaml). */
export function findScenarioFile(skill: ParsedSkill): string | null {
  const candidates = [
    join(skill.dir, "skill.test.yaml"),
    join(skill.dir, "skill.test.yml"),
    join(skill.dir, "tests.yaml"),
    join(skill.dir, "tests.yml"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** Load and validate scenarios from a skill's test file. */
export function loadScenarios(file: string): Scenario[] {
  const doc = parseYaml(readFileSync(file, "utf8"));
  const parsed = ScenarioFileSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Error(
      `Invalid scenario file ${file}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return parsed.data.scenarios;
}

/** Apply a scenario's expectations to an agent run, returning failure reasons. */
function evaluate(scenario: Scenario, output: string, toolsUsed: string[], errored: boolean): string[] {
  const reasons: string[] = [];
  const exp = scenario.expect;
  const haystack = output.toLowerCase();

  if (exp.no_error && errored) {
    reasons.push("agent reported an error but no_error was expected");
  }
  for (const needle of exp.output_contains ?? []) {
    if (!haystack.includes(needle.toLowerCase())) {
      reasons.push(`output did not contain "${needle}"`);
    }
  }
  for (const pattern of exp.output_matches ?? []) {
    let re: RegExp;
    try {
      re = new RegExp(pattern, "i");
    } catch {
      reasons.push(`invalid expect.output_matches regex: ${pattern}`);
      continue;
    }
    if (!re.test(output)) reasons.push(`output did not match /${pattern}/`);
  }
  const used = new Set(toolsUsed.map((t) => t.toLowerCase()));
  for (const tool of exp.tools_used ?? []) {
    if (!used.has(tool.toLowerCase())) reasons.push(`expected tool "${tool}" was not used`);
  }
  for (const tool of exp.tools_not_used ?? []) {
    if (used.has(tool.toLowerCase())) reasons.push(`forbidden tool "${tool}" was used`);
  }
  return reasons;
}

/** Seed any scenario.files into a throwaway working directory. */
function makeWorkdir(scenario: Scenario): string {
  const dir = mkdtempSync(join(tmpdir(), "skillci-"));
  for (const [rel, content] of Object.entries(scenario.files ?? {})) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

export interface RunScenariosOptions {
  agent: AgentAdapter;
  allowedTools?: string[];
  timeoutMs?: number;
}

/** Run every scenario for a skill through the given agent adapter. */
export async function runScenarios(
  skill: ParsedSkill,
  scenarios: Scenario[],
  options: RunScenariosOptions
): Promise<ScenarioResult[]> {
  const { agent, allowedTools = DEFAULT_ALLOWED_TOOLS, timeoutMs = 120_000 } = options;
  const results: ScenarioResult[] = [];

  const available = await agent.isAvailable();
  for (const scenario of scenarios) {
    if (!available) {
      results.push({
        scenario: scenario.name,
        passed: false,
        skipped: true,
        reasons: [`agent "${agent.id}" is not available on this machine`],
        toolsUsed: [],
        output: "",
        durationMs: 0,
      });
      continue;
    }

    const cwd = makeWorkdir(scenario);
    const started = Date.now();
    try {
      const run = await agent.run({ skill, scenario, allowedTools, cwd, timeoutMs });
      const reasons = evaluate(scenario, run.output, run.toolsUsed, run.errored);
      if (run.errored && run.errorMessage) reasons.unshift(`agent error: ${run.errorMessage}`);
      results.push({
        scenario: scenario.name,
        passed: reasons.length === 0,
        skipped: false,
        reasons,
        toolsUsed: run.toolsUsed,
        output: run.output,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      results.push({
        scenario: scenario.name,
        passed: false,
        skipped: false,
        reasons: [`runner threw: ${(err as Error).message}`],
        toolsUsed: [],
        output: "",
        durationMs: Date.now() - started,
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
  return results;
}
