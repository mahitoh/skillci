#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { Command } from "commander";
import pc from "picocolors";
import {
  checkPath,
  discoverSkills,
  checkSkill,
  loadRules,
  printReport,
  renderHtml,
  badgeMarkdown,
  badgeEndpoint,
  listAgents,
} from "./index.js";
import type { SkillReport } from "./types.js";
import { writeScenarioTemplate } from "./init.js";

const program = new Command();

program
  .name("skillci")
  .description("CI for AI agent skills — lint, safety-audit, and scenario-test SKILL.md skills.")
  .version("0.1.0");

interface CommonOpts {
  json?: boolean;
  html?: string;
  agent?: string;
  allowTools?: string;
  timeout?: string;
}

function summarize(reports: SkillReport[], opts: CommonOpts): number {
  if (opts.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const r of reports) printReport(r);
    const verified = reports.filter((r) => r.verified).length;
    console.log("");
    console.log(
      pc.bold(`${verified}/${reports.length} skills verified`) +
        (reports.length ? "" : pc.dim(" (no SKILL.md found)"))
    );
  }
  if (opts.html) {
    writeFileSync(opts.html, renderHtml(reports), "utf8");
    if (!opts.json) console.log(pc.dim(`HTML report written to ${opts.html}`));
  }
  // Exit non-zero if any skill is not verified, so CI fails loudly.
  return reports.some((r) => !r.verified) ? 1 : 0;
}

async function reportsForCommand(
  path: string,
  opts: CommonOpts,
  mode: "lint" | "audit" | "full"
): Promise<SkillReport[]> {
  const allowedTools = opts.allowTools?.split(",").map((s) => s.trim()).filter(Boolean);
  const timeoutMs = opts.timeout ? Number(opts.timeout) * 1000 : undefined;
  const reports = await checkPath(path, {
    test: mode === "full",
    agentId: opts.agent,
    allowedTools,
    timeoutMs,
  });
  // For lint/audit-only modes, blank out the other section's findings in output
  // by reusing the full report but the section printer already separates them.
  if (mode === "lint") {
    return reports.map((r) => ({ ...r, audit: [], scenarios: [] }));
  }
  if (mode === "audit") {
    return reports.map((r) => ({ ...r, lint: [], scenarios: [] }));
  }
  return reports;
}

const common = (cmd: Command) =>
  cmd
    .argument("[path]", "skill file, skill directory, or directory of skills", ".")
    .option("--json", "output machine-readable JSON")
    .option("--html <file>", "also write an HTML report to <file>")
    .option("--agent <id>", "agent adapter to test with (default: first available)")
    .option("--allow-tools <list>", "comma-separated tools the agent may use during tests")
    .option("--timeout <seconds>", "per-scenario timeout in seconds");

common(program.command("lint"))
  .description("structural checks: valid frontmatter, name, description, references")
  .action(async (path: string, opts: CommonOpts) => {
    process.exitCode = summarize(await reportsForCommand(path, opts, "lint"), opts);
  });

common(program.command("audit"))
  .description("static safety scan for prompt injection, exfiltration, and malicious patterns")
  .action(async (path: string, opts: CommonOpts) => {
    process.exitCode = summarize(await reportsForCommand(path, opts, "audit"), opts);
  });

common(program.command("test"))
  .description("run scenario tests through an agent (requires an agent CLI installed)")
  .action(async (path: string, opts: CommonOpts) => {
    const allowedTools = opts.allowTools?.split(",").map((s) => s.trim()).filter(Boolean);
    const timeoutMs = opts.timeout ? Number(opts.timeout) * 1000 : undefined;
    const skills = discoverSkills(path);
    const reports: SkillReport[] = [];
    for (const s of skills) {
      const full = await checkSkill(s, { test: true, agentId: opts.agent, allowedTools, timeoutMs });
      reports.push({ ...full, lint: [], audit: [] });
    }
    process.exitCode = summarize(reports, opts);
  });

common(program.command("run"))
  .description("the full gate: lint + audit + test in one pass (use this in CI)")
  .action(async (path: string, opts: CommonOpts) => {
    process.exitCode = summarize(await reportsForCommand(path, opts, "full"), opts);
  });

program
  .command("badge")
  .description("print a README badge (and endpoint JSON) for a skill's status")
  .argument("[path]", "skill file or directory", ".")
  .option("--endpoint <file>", "write shields.io endpoint JSON to <file>")
  .action(async (path: string, opts: { endpoint?: string }) => {
    const skills = discoverSkills(path);
    if (skills.length === 0) {
      console.error(pc.red("No SKILL.md found."));
      process.exitCode = 1;
      return;
    }
    const report = await checkSkill(skills[0], { test: false });
    console.log(badgeMarkdown(report));
    if (opts.endpoint) {
      writeFileSync(opts.endpoint, JSON.stringify(badgeEndpoint(report), null, 2));
      console.log(pc.dim(`endpoint JSON written to ${opts.endpoint}`));
    }
  });

program
  .command("init")
  .description("scaffold a skill.test.yaml next to a skill to get started")
  .argument("[path]", "skill directory", ".")
  .action((path: string) => {
    const written = writeScenarioTemplate(path);
    if (written) console.log(pc.green(`Created ${written}`));
    else console.log(pc.yellow("A scenario file already exists or no SKILL.md was found."));
  });

program
  .command("rules")
  .description("list the built-in safety rules")
  .option("--json", "output as JSON")
  .action((opts: { json?: boolean }) => {
    const rules = loadRules();
    if (opts.json) {
      console.log(JSON.stringify(rules, null, 2));
      return;
    }
    console.log(pc.bold(`${rules.length} safety rules:\n`));
    for (const r of rules) {
      const sev = r.severity === "error" ? pc.red("error") : r.severity === "warning" ? pc.yellow("warn") : pc.dim("info");
      console.log(`  ${sev}  ${pc.bold(r.id)}`);
      console.log(`        ${r.description}`);
    }
  });

program
  .command("agents")
  .description("list available agent adapters and whether each is installed")
  .action(async () => {
    console.log(pc.bold("agent adapters:\n"));
    for (const a of listAgents()) {
      const ok = await a.isAvailable();
      const status = ok ? pc.green("available") : pc.dim("not found");
      console.log(`  ${status}  ${pc.bold(a.id)}  ${pc.dim(a.label)}`);
    }
  });

program.parseAsync().catch((err) => {
  console.error(pc.red(`skillci: ${(err as Error).message}`));
  process.exit(2);
});
