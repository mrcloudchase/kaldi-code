import type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from "../types/index.js";
import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { BaseSafety } from "../safety/base.js";
import { buildSystemPrompt } from "../prompts/system.js";
import { parseStream } from "./parse-stream.js";

interface SubAgentOptions {
  maxTurns?: number;
}

export class SubAgentRunner {
  private messages: Message[] = [];
  private provider: BaseProvider;
  private tools: ToolRegistry;
  private safety: BaseSafety;
  private maxTurns: number;
  private abortController: AbortController | null = null;

  constructor(
    provider: BaseProvider,
    tools: ToolRegistry,
    safety: BaseSafety,
    options: SubAgentOptions = {},
  ) {
    this.provider = provider;
    this.tools = tools;
    this.safety = safety;
    this.maxTurns = options.maxTurns ?? 10;
  }

  async run(task: string): Promise<string> {
    const systemPrompt = buildSystemPrompt(process.cwd());
    this.messages.push({ role: "user", content: task });

    let turns = 0;
    let lastTextResponse = "";

    while (turns < this.maxTurns) {
      turns++;

      this.abortController = new AbortController();
      const schemas = this.tools.buildSchemas();

      const contentBlocks = await parseStream(
        this.provider.stream(
          this.messages,
          systemPrompt,
          schemas,
          this.abortController.signal,
        ),
      );

      this.abortController = null;
      this.messages.push({ role: "assistant", content: contentBlocks });

      // Extract text and tool_use blocks
      const textBlocks = contentBlocks.filter(
        (b): b is TextBlock => b.type === "text",
      );
      const toolUses = contentBlocks.filter(
        (b): b is ToolUseBlock => b.type === "tool_use",
      );

      if (textBlocks.length > 0) {
        lastTextResponse = textBlocks.map((b) => b.text).join("\n");
      }

      if (toolUses.length === 0) break;

      // Execute tools
      const toolResults: ToolResultBlock[] = [];
      for (const toolUse of toolUses) {
        const tool = this.tools.get(toolUse.name);
        const result = tool
          ? await tool.execute(toolUse.input)
          : `error: unknown tool '${toolUse.name}'`;

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      this.messages.push({ role: "user", content: toolResults });
    }

    return lastTextResponse || "(sub-agent produced no text output)";
  }

  abort(): void {
    this.abortController?.abort();
  }
}
