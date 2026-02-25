import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class WriteTool extends BaseTool {
  readonly name = "write";
  readonly description = "Write content to a file. Creates the file if it doesn't exist, and creates parent directories as needed. Overwrites existing content.";
  readonly params: ToolParam[] = [
    { name: "path", type: "string", description: "File path to write to", required: true },
    { name: "content", type: "string", description: "Content to write to the file", required: true },
  ];
  readonly safety = "unsafe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const path = input.path as string;
    const content = input.content as string;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return "ok";
  }
}
