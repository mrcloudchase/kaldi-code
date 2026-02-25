import type { ToolParam, ToolSchema } from "../types/index.js";

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly params: ToolParam[];
  abstract readonly safety: "safe" | "unsafe";

  protected abstract run(input: Record<string, unknown>): Promise<string>;

  async execute(input: Record<string, unknown>): Promise<string> {
    try {
      this.validateInput(input);
      return await this.run(input);
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private validateInput(input: Record<string, unknown>): void {
    for (const param of this.params) {
      if (param.required && !(param.name in input)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }
  }

  toSchema(): ToolSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of this.params) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties,
        required,
      },
    };
  }
}
