import { readFile } from "node:fs/promises";
import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class ReadTool extends BaseTool {
  readonly name = "read";
  readonly description = "Read a file and return its contents with line numbers. Supports optional offset and limit for reading portions of large files.";
  readonly params: ToolParam[] = [
    { name: "path", type: "string", description: "Absolute or relative file path to read", required: true },
    { name: "offset", type: "number", description: "Line number to start reading from (0-based)", required: false },
    { name: "limit", type: "number", description: "Maximum number of lines to return", required: false },
  ];
  readonly safety = "safe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const path = input.path as string;
    const content = await readFile(path, "utf-8");
    const lines = content.split("\n");
    const start = (input.offset as number | undefined) ?? 0;
    const limit = (input.limit as number | undefined) ?? lines.length;
    const end = Math.min(start + limit, lines.length);

    return lines
      .slice(start, end)
      .map((line, i) => `${String(start + i + 1).padStart(4)}| ${line}`)
      .join("\n");
  }
}
