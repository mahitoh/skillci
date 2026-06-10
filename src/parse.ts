import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import matter from "gray-matter";
import type { ParsedSkill } from "./types.js";

/**
 * Resolve a user-supplied path to a SKILL.md file.
 * Accepts either the file itself or a directory containing it
 * (case-insensitive: SKILL.md, Skill.md, skill.md).
 */
export function resolveSkillFile(input: string): string | null {
  if (!existsSync(input)) return null;
  const stat = statSync(input);
  if (stat.isFile()) return input;
  if (stat.isDirectory()) {
    const entries = readdirSync(input);
    const match = entries.find((e) => e.toLowerCase() === "skill.md");
    if (match) return join(input, match);
  }
  return null;
}

/** List sibling files in the skill directory (recursively, excluding SKILL.md). */
function listSkillFiles(dir: string, skillFile: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (full !== skillFile) {
        out.push(relative(dir, full).split("\\").join("/"));
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** Parse a SKILL.md path into a structured ParsedSkill. Throws if unreadable. */
export function parseSkill(skillPath: string): ParsedSkill {
  const raw = readFileSync(skillPath, "utf8");
  const parsed = matter(raw);
  const dir = dirname(skillPath);
  return {
    path: skillPath,
    dir,
    frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
    body: parsed.content.trim(),
    raw,
    files: listSkillFiles(dir, skillPath),
  };
}

/** Read the text content of every sibling script-like file (for auditing). */
export function readSkillScripts(skill: ParsedSkill): Array<{ file: string; content: string }> {
  const scriptExt = /\.(sh|bash|zsh|py|js|ts|mjs|cjs|rb|pl|ps1|bat|cmd)$/i;
  return skill.files
    .filter((f) => scriptExt.test(f))
    .map((f) => {
      try {
        return { file: f, content: readFileSync(join(skill.dir, f), "utf8") };
      } catch {
        return { file: f, content: "" };
      }
    });
}

export { basename };
