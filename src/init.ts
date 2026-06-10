import { existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveSkillFile } from "./parse.js";

const TEMPLATE = `# skillci scenario tests.
# Each scenario sends \`prompt\` to an agent with this skill's instructions
# injected, then checks the result against \`expect\`. Run with: skillci test
scenarios:
  - name: example — describe what should happen
    prompt: |
      Ask the agent to do the thing this skill is for.
    # Optionally seed files into the agent's working directory:
    # files:
    #   input.txt: "some content"
    expect:
      no_error: true
      output_contains:
        - "a phrase you expect in the answer"
      # output_matches:
      #   - "regex.*here"
      # tools_used:
      #   - Read
      # tools_not_used:
      #   - Bash
`;

/** Write a starter skill.test.yaml next to a skill. Returns path or null. */
export function writeScenarioTemplate(input: string): string | null {
  const skillFile = resolveSkillFile(input);
  if (!skillFile) return null;
  const dir = dirname(skillFile);
  const target = join(dir, "skill.test.yaml");
  if (existsSync(target) || existsSync(join(dir, "skill.test.yml"))) return null;
  writeFileSync(target, TEMPLATE, "utf8");
  return target;
}
