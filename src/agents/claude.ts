import { spawn } from "node:child_process";
import type { AgentAdapter, AgentRun } from "../types.js";

/**
 * Resolve the claude executable. We use the bare name and let the shell resolve
 * the real binary via PATH/PATHEXT (claude.exe, claude.cmd, or claude), rather
 * than guessing an extension that may not match the user's install.
 */
function claudeBin(): string {
  return process.env.SKILLCI_CLAUDE_BIN || "claude";
}

/** Check whether a command resolves on PATH by probing `--version`. */
function probe(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { shell: process.platform === "win32" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  message?: { content?: Array<{ type?: string; name?: string; text?: string }> };
  result?: string;
  is_error?: boolean;
}

/**
 * Adapter that runs scenarios through the Claude Code CLI in headless mode.
 *
 * Rather than relying on non-deterministic skill auto-discovery, we inject the
 * skill's instructions via `--append-system-prompt` and constrain the agent to
 * `--allowedTools`, so the test deterministically exercises the skill while the
 * CLI's own permission system provides isolation (no Docker required).
 */
export const claudeAdapter: AgentAdapter = {
  id: "claude",
  label: "Claude Code (headless)",

  async isAvailable() {
    return probe(claudeBin(), ["--version"]);
  },

  async run({ skill, scenario, allowedTools, cwd, timeoutMs }): Promise<AgentRun> {
    const systemPrompt = [
      "You have the following skill available. Follow its instructions when relevant.",
      "",
      `--- SKILL: ${String(skill.frontmatter.name ?? "unnamed")} ---`,
      skill.body,
      "--- END SKILL ---",
    ].join("\n");

    const args = [
      "-p",
      scenario.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--append-system-prompt",
      systemPrompt,
    ];
    if (allowedTools.length > 0) {
      args.push("--allowedTools", allowedTools.join(","));
    }

    return new Promise<AgentRun>((resolve) => {
      const child = spawn(claudeBin(), args, {
        cwd,
        shell: process.platform === "win32",
        env: process.env,
      });

      const toolsUsed = new Set<string>();
      let finalText = "";
      let errored = false;
      let errorMessage: string | undefined;
      let stdoutBuf = "";
      let stderrBuf = "";

      const timer = setTimeout(() => {
        errored = true;
        errorMessage = `Timed out after ${timeoutMs}ms`;
        child.kill("SIGKILL");
      }, timeoutMs);

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: StreamEvent;
        try {
          evt = JSON.parse(trimmed) as StreamEvent;
        } catch {
          return; // non-JSON noise
        }
        if (evt.type === "assistant" && evt.message?.content) {
          for (const block of evt.message.content) {
            if (block.type === "tool_use" && block.name) toolsUsed.add(block.name);
          }
        }
        if (evt.type === "result") {
          if (typeof evt.result === "string") finalText = evt.result;
          if (evt.is_error) {
            errored = true;
            errorMessage = evt.subtype ?? "agent reported an error";
          }
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split("\n");
        stdoutBuf = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString();
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ output: "", toolsUsed: [], errored: true, errorMessage: err.message });
      });
      child.on("close", () => {
        clearTimeout(timer);
        if (stdoutBuf) handleLine(stdoutBuf);
        if (!finalText && stderrBuf && errored) errorMessage = stderrBuf.slice(0, 500);
        resolve({
          output: finalText,
          toolsUsed: [...toolsUsed],
          errored,
          errorMessage,
        });
      });
    });
  },
};
