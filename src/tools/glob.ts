import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class GlobTool extends BaseTool {
  readonly name = "glob";
  readonly description = "Find files matching a glob pattern. Returns matching file paths, one per line. Useful for discovering project structure and finding files by name or extension.";
  readonly params: ToolParam[] = [
    { name: "pattern", type: "string", description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.tsx')", required: true },
    { name: "path", type: "string", description: "Base directory to search from (default: cwd)", required: false },
  ];
  readonly safety = "safe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const pattern = input.pattern as string;
    const basePath = (input.path as string | undefined) ?? ".";
    const fullPattern = basePath === "." ? pattern : `${basePath}/${pattern}`;

    const files: string[] = [];
    for await (const file of new Bun.Glob(fullPattern).scan({ dot: false })) {
      if (file.includes("node_modules")) continue;
      files.push(file);
      if (files.length >= 200) break;
    }

    files.sort();
    return files.join("\n") || "No matching files found.";
  }
}
