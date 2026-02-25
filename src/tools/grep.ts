import { readFile } from "node:fs/promises";
import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class GrepTool extends BaseTool {
  readonly name = "grep";
  readonly description = "Search file contents for a regex pattern. Returns matching lines with file path, line number, and content. Searches recursively from the given path.";
  readonly params: ToolParam[] = [
    { name: "pattern", type: "string", description: "Regex pattern to search for", required: true },
    { name: "path", type: "string", description: "Base directory to search from (default: cwd)", required: false },
    { name: "glob", type: "string", description: "File glob to filter (e.g. '**/*.ts')", required: false },
  ];
  readonly safety = "safe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const pattern = new RegExp(input.pattern as string);
    const basePath = (input.path as string | undefined) ?? ".";
    const fileGlob = (input.glob as string | undefined) ?? "**/*";
    const fullGlob = basePath === "." ? fileGlob : `${basePath}/${fileGlob}`;

    const hits: string[] = [];

    for await (const file of new Bun.Glob(fullGlob).scan({ dot: false })) {
      if (file.includes("node_modules") || file.includes(".git")) continue;
      try {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i]!)) {
            hits.push(`${file}:${i + 1}:${lines[i]!.trim()}`);
            if (hits.length >= 50) break;
          }
        }
      } catch {
        // Skip binary/unreadable files
      }
      if (hits.length >= 50) break;
    }

    return hits.join("\n") || "No matches found.";
  }
}
