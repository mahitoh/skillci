import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { AuditRuleSchema, type AuditRule, type Finding, type ParsedSkill } from "./types.js";
import { readSkillScripts } from "./parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Locate the bundled `rules/` directory whether running from src or dist. */
function defaultRulesDir(): string {
  const candidates = [
    join(__dirname, "..", "rules"), // dist/ -> ../rules
    join(__dirname, "..", "..", "rules"), // src/ -> ../../rules
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

/** Load and validate all rules from a directory of .yml/.yaml packs. */
export function loadRules(rulesDir = defaultRulesDir()): AuditRule[] {
  if (!existsSync(rulesDir)) return [];
  const rules: AuditRule[] = [];
  const seen = new Set<string>();
  for (const file of readdirSync(rulesDir)) {
    if (!/\.ya?ml$/i.test(file)) continue;
    const doc = parseYaml(readFileSync(join(rulesDir, file), "utf8"));
    if (!Array.isArray(doc)) continue;
    for (const entry of doc) {
      const parsed = AuditRuleSchema.safeParse(entry);
      if (!parsed.success) {
        throw new Error(
          `Invalid rule in ${file}: ${parsed.error.issues.map((i) => i.message).join(", ")}`
        );
      }
      if (seen.has(parsed.data.id)) {
        throw new Error(`Duplicate rule id "${parsed.data.id}" in ${file}`);
      }
      seen.add(parsed.data.id);
      rules.push(parsed.data);
    }
  }
  return rules;
}

/** Compute the 1-based line number of a match offset within text. */
function lineFromOffset(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

interface AuditTarget {
  /** Logical name for findings: "SKILL.md" or the script path. */
  file: string;
  text: string;
  kind: "body" | "frontmatter" | "scripts";
}

/** Build the set of text blobs a rule may apply to, per its `target`. */
function targetsFor(skill: ParsedSkill): AuditTarget[] {
  const targets: AuditTarget[] = [
    { file: "SKILL.md", text: skill.body, kind: "body" },
    { file: "SKILL.md", text: JSON.stringify(skill.frontmatter), kind: "frontmatter" },
  ];
  for (const s of readSkillScripts(skill)) {
    targets.push({ file: s.file, text: s.content, kind: "scripts" });
  }
  return targets;
}

function ruleApplies(rule: AuditRule, target: AuditTarget): boolean {
  if (rule.target === "all") return target.kind !== "frontmatter" || true;
  return rule.target === target.kind;
}

/**
 * Run all safety rules against a skill. This is pure static analysis — it never
 * executes the skill — so it needs no agent, no Docker, no network.
 */
export function auditSkill(skill: ParsedSkill, rules = loadRules()): Finding[] {
  const findings: Finding[] = [];
  const targets = targetsFor(skill);

  for (const rule of rules) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "gim");
    } catch (err) {
      throw new Error(`Rule ${rule.id} has an invalid regex: ${(err as Error).message}`);
    }
    for (const target of targets) {
      if (!ruleApplies(rule, target)) continue;
      re.lastIndex = 0;
      const match = re.exec(target.text);
      if (match) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          message: rule.name + (rule.description ? ` — ${rule.description}` : ""),
          hint: rule.hint,
          line: target.kind === "frontmatter" ? undefined : lineFromOffset(target.text, match.index),
          file: target.file,
        });
      }
    }
  }

  // De-duplicate identical (id, file) pairs to keep reports clean.
  const deduped = new Map<string, Finding>();
  for (const f of findings) {
    deduped.set(`${f.id}:${f.file}`, f);
  }
  return [...deduped.values()];
}
