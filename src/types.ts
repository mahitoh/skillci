import { z } from "zod";

/** Severity levels shared across lint findings and audit rules. */
export type Severity = "error" | "warning" | "info";

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 2,
  warning: 1,
  info: 0,
};

/** A parsed SKILL.md file. */
export interface ParsedSkill {
  /** Absolute path to the SKILL.md file. */
  path: string;
  /** Absolute path to the skill directory containing SKILL.md. */
  dir: string;
  /** Raw frontmatter object (untyped — validated separately by lint). */
  frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** Full raw file contents. */
  raw: string;
  /** Sibling files in the skill directory (relative paths), e.g. scripts. */
  files: string[];
}

/** Frontmatter shape we expect; lint reports deviations rather than throwing. */
export const FrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  license: z.string().optional(),
  version: z.string().optional(),
  "allowed-tools": z.union([z.string(), z.array(z.string())]).optional(),
});

/** A single finding produced by lint or audit. */
export interface Finding {
  /** Stable identifier, e.g. "lint/missing-description" or "audit/curl-pipe-sh". */
  id: string;
  severity: Severity;
  message: string;
  /** Optional human hint on how to fix. */
  hint?: string;
  /** 1-based line number within the source file, when known. */
  line?: number;
  /** Which file the finding refers to, relative to the skill dir. */
  file?: string;
}

/** A safety rule loaded from a YAML rule pack. */
export const AuditRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]),
  description: z.string().default(""),
  hint: z.string().optional(),
  /** Where to look: skill body, frontmatter, sibling script files, or all. */
  target: z.enum(["body", "frontmatter", "scripts", "all"]).default("all"),
  /** Regex source string; matched case-insensitively, multiline. */
  pattern: z.string().min(1),
});
export type AuditRule = z.infer<typeof AuditRuleSchema>;

/** A scenario test case authored alongside a skill (skill.test.yaml). */
export const ScenarioSchema = z.object({
  name: z.string().min(1),
  /** The user prompt that should exercise the skill. */
  prompt: z.string().min(1),
  /** Optional files to seed into the agent's working directory. */
  files: z.record(z.string()).optional(),
  expect: z
    .object({
      output_contains: z.array(z.string()).optional(),
      output_matches: z.array(z.string()).optional(),
      tools_used: z.array(z.string()).optional(),
      tools_not_used: z.array(z.string()).optional(),
      no_error: z.boolean().optional(),
    })
    .default({}),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenarioFileSchema = z.object({
  scenarios: z.array(ScenarioSchema).min(1),
});

/** Result of running a single scenario through an agent. */
export interface ScenarioResult {
  scenario: string;
  passed: boolean;
  skipped: boolean;
  /** Reason for skip or failure detail. */
  reasons: string[];
  /** Tools the agent invoked during the run. */
  toolsUsed: string[];
  /** Final text output from the agent. */
  output: string;
  durationMs: number;
}

/** What an agent adapter returns after running a prompt. */
export interface AgentRun {
  output: string;
  toolsUsed: string[];
  errored: boolean;
  errorMessage?: string;
}

/** Pluggable agent backend. Add one per coding agent (claude, codex, ...). */
export interface AgentAdapter {
  /** Short id used with `--agent <id>`. */
  id: string;
  /** Human label for reports. */
  label: string;
  /** Whether this adapter can run on the current machine right now. */
  isAvailable(): Promise<boolean>;
  /** Run a scenario prompt with the skill's instructions injected. */
  run(input: {
    skill: ParsedSkill;
    scenario: Scenario;
    /** Tools the agent is permitted to use during the test. */
    allowedTools: string[];
    cwd: string;
    timeoutMs: number;
  }): Promise<AgentRun>;
}

/** Aggregate result of a full `skillci run` over one skill. */
export interface SkillReport {
  skillName: string;
  skillPath: string;
  lint: Finding[];
  audit: Finding[];
  scenarios: ScenarioResult[];
  /** Computed grade 0-100 and pass/fail verdict. */
  score: number;
  verified: boolean;
}
