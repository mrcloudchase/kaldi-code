import { readFile, writeFile } from "node:fs/promises";
import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

export class EditTool extends BaseTool {
  readonly name = "edit";
  readonly description = "Replace exact string matches in a file. By default replaces only the first occurrence and fails if the string appears multiple times (to prevent unintended changes). Set replace_all to true to replace all occurrences.";
  readonly params: ToolParam[] = [
    { name: "path", type: "string", description: "File path to edit", required: true },
    { name: "old", type: "string", description: "Exact string to find and replace", required: true },
    { name: "new", type: "string", description: "Replacement string", required: true },
    { name: "replace_all", type: "boolean", description: "Replace all occurrences (default: false)", required: false },
  ];
  readonly safety = "unsafe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const path = input.path as string;
    const old = input.old as string;
    const replacement = input.new as string;
    const replaceAll = (input.replace_all as boolean) ?? false;

    const content = await readFile(path, "utf-8");
    if (!content.includes(old)) {
      return "error: old_string not found in file";
    }

    const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (content.match(new RegExp(escaped, "g")) ?? []).length;

    if (!replaceAll && count > 1) {
      return `error: old_string appears ${count} times. Use replace_all: true to replace all, or provide more context to make the match unique.`;
    }

    const result = replaceAll
      ? content.split(old).join(replacement)
      : content.replace(old, replacement);

    await writeFile(path, result, "utf-8");
    return "ok";
  }
}
