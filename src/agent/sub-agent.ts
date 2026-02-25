import type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  TokenUsage,
} from "../types/index.js";
import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { BaseSafety } from "../safety/base.js";
import { buildSystemPrompt } from "../prompts/system.js";
import { BaseAgent } from "./base.js";

interface SubAgentOptions {
  maxTurns?: number;
}

export class SubAgentRunner extends BaseAgent {
  private maxTurns: number;
  private abortController: AbortController | null = null;

  constructor(
    provider: BaseProvider,
    tools: ToolRegistry,
    safety: BaseSafety,
    options: SubAgentOptions = {},
  ) {
    super(provider, tools, safety);
    this.maxTurns = options.maxTurns ?? 10;
  }

  async run(task: string): Promise<string> {
    const systemPrompt = buildSystemPrompt(process.cwd());
    this.messages.push({ role: "user", content: task });

    let turns = 0;
    let lastTextResponse = "";

    while (turns < this.maxTurns) {
      turns++;

      const { contentBlocks } = await this.streamTurnSilent(systemPrompt);
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

  private async streamTurnSilent(
    systemPrompt: string,
  ): Promise<{ contentBlocks: ContentBlock[] }> {
    this.abortController = new AbortController();
    const schemas = this.tools.buildSchemas();

    const contentBlocks: ContentBlock[] = [];
    let currentText = "";
    let currentToolUse: ToolUseBlock | null = null;
    let jsonAccumulator = "";

    for await (const event of this.provider.stream(
      this.messages,
      systemPrompt,
      schemas,
      this.abortController.signal,
    )) {
      switch (event.type) {
        case "text_delta":
          currentText += event.text;
          break;
        case "tool_use_start":
          if (currentText) {
            contentBlocks.push({ type: "text", text: currentText });
            currentText = "";
          }
          currentToolUse = {
            type: "tool_use",
            id: event.id,
            name: event.name,
            input: {},
          };
          jsonAccumulator = "";
          break;
        case "tool_input_delta":
          jsonAccumulator += event.partialJson;
          break;
        case "tool_use_end":
          if (currentToolUse) {
            currentToolUse.input = event.input;
            contentBlocks.push(currentToolUse);
            currentToolUse = null;
          }
          break;
      }
    }

    if (currentText) {
      contentBlocks.push({ type: "text", text: currentText });
    }

    this.abortController = null;
    return { contentBlocks };
  }

  // Required by BaseAgent but unused for sub-agents (use run() instead)
  async sendMessage(_text: string): Promise<void> {
    throw new Error("Use SubAgentRunner.run() instead of sendMessage()");
  }

  abort(): void {
    this.abortController?.abort();
  }
}
