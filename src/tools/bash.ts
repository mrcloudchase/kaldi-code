import { execSync } from "node:child_process";
import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class BashTool extends BaseTool {
  readonly name = "bash";
  readonly description = "Execute a shell command and return its output. Commands run in the current working directory with a 30-second timeout. Use for git operations, running tests, installing packages, etc.";
  readonly params: ToolParam[] = [
    { name: "command", type: "string", description: "Shell command to execute", required: true },
    { name: "timeout", type: "number", description: "Timeout in milliseconds (default: 30000)", required: false },
  ];
  readonly safety = "unsafe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const command = input.command as string;
    const timeout = (input.timeout as number | undefined) ?? 30000;

    try {
      const output = execSync(command, {
        encoding: "utf-8",
        timeout,
        maxBuffer: 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return output.trim() || "(empty output)";
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      return (execErr.stdout ?? execErr.stderr ?? execErr.message ?? String(err)).trim();
    }
  }
}
