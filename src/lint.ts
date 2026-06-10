import { FrontmatterSchema, type Finding, type ParsedSkill } from "./types.js";

/** Find the 1-based line number of a frontmatter key in the raw file. */
function frontmatterLine(raw: string, key: string): number | undefined {
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^\\s*${key}\\s*:`).test(lines[i])) return i + 1;
  }
  return undefined;
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const DESCRIPTION_MAX = 1024;
const DESCRIPTION_MIN = 20;

/**
 * Structural lint of a SKILL.md: valid frontmatter, sane name/description,
 * non-empty body, referenced files that actually exist. These are the
 * "does it even load" checks every agent runtime cares about.
 */
export function lintSkill(skill: ParsedSkill): Finding[] {
  const findings: Finding[] = [];
  const fm = skill.frontmatter;

  const parsed = FrontmatterSchema.safeParse(fm);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "frontmatter");
      findings.push({
        id: `lint/frontmatter-${key}`,
        severity: "error",
        message: `Frontmatter field \`${key}\` is invalid: ${issue.message}`,
        hint: "Every skill needs a valid `name` and `description` in YAML frontmatter.",
        line: frontmatterLine(skill.raw, key),
        file: "SKILL.md",
      });
    }
  }

  const name = typeof fm.name === "string" ? fm.name : "";
  if (name && !NAME_RE.test(name)) {
    findings.push({
      id: "lint/name-format",
      severity: "warning",
      message: `Skill name "${name}" should be lowercase kebab-case (a-z, 0-9, hyphens).`,
      hint: "Most registries key skills by this name; non-standard names break install commands.",
      line: frontmatterLine(skill.raw, "name"),
      file: "SKILL.md",
    });
  }
  if (name.length > 64) {
    findings.push({
      id: "lint/name-length",
      severity: "warning",
      message: `Skill name is ${name.length} chars; keep it under 64.`,
      file: "SKILL.md",
    });
  }

  const description = typeof fm.description === "string" ? fm.description : "";
  if (description && description.length < DESCRIPTION_MIN) {
    findings.push({
      id: "lint/description-short",
      severity: "warning",
      message: `Description is only ${description.length} chars. A vague description means the agent won't know when to use the skill.`,
      hint: "Describe what the skill does AND when to trigger it, in the third person.",
      line: frontmatterLine(skill.raw, "description"),
      file: "SKILL.md",
    });
  }
  if (description.length > DESCRIPTION_MAX) {
    findings.push({
      id: "lint/description-long",
      severity: "warning",
      message: `Description is ${description.length} chars; many runtimes truncate past ${DESCRIPTION_MAX}.`,
      line: frontmatterLine(skill.raw, "description"),
      file: "SKILL.md",
    });
  }

  if (skill.body.length < 40) {
    findings.push({
      id: "lint/body-empty",
      severity: "error",
      message: "Skill body is empty or near-empty; there are no instructions for the agent to follow.",
      hint: "Add the actual procedure the agent should perform.",
      file: "SKILL.md",
    });
  }

  // Flag referenced sibling files that don't exist (broken skill).
  // Branch 1: paths wrapped in markdown links, quotes, or backticks (any ext).
  // Branch 2: bare mentions of script files (high-signal extensions only, to
  // avoid flagging prose that happens to contain a word with a dot).
  const refRe =
    /(?:\]\(|["'`])([\w./-]+\.(?:sh|py|js|ts|md|json|ya?ml|txt))(?:["'`)])|\b([\w./-]+\.(?:sh|py|js|ts|mjs|cjs|rb|pl|ps1))\b/g;
  const referenced = new Set<string>();
  for (const m of skill.body.matchAll(refRe)) {
    const ref = m[1] ?? m[2];
    if (!ref || ref.startsWith("http") || ref.startsWith("/") || ref === "SKILL.md") continue;
    referenced.add(ref.replace(/^\.\//, ""));
  }
  const present = new Set(skill.files);
  for (const ref of referenced) {
    if (!present.has(ref)) {
      findings.push({
        id: "lint/missing-referenced-file",
        severity: "warning",
        message: `Body references \`${ref}\` but no such file exists in the skill directory.`,
        hint: "Either add the file or fix the reference; agents will fail when they try to read it.",
        file: "SKILL.md",
      });
    }
  }

  return findings;
}
