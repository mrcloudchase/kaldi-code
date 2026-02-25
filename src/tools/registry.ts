import type { ToolSchema } from "../types/index.js";
import type { BaseTool } from "./base.js";

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  buildSchemas(): ToolSchema[] {
    return this.getAll().map((tool) => tool.toSchema());
  }

  without(...names: string[]): ToolRegistry {
    const registry = new ToolRegistry();
    for (const [name, tool] of this.tools) {
      if (!names.includes(name)) {
        registry.register(tool);
      }
    }
    return registry;
  }

  filter(allowedNames: string[]): ToolRegistry {
    const registry = new ToolRegistry();
    for (const name of allowedNames) {
      const tool = this.tools.get(name);
      if (tool) registry.register(tool);
    }
    return registry;
  }
}
