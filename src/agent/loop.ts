import { EventEmitter } from "node:events";
import type {
  Message,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  AgentEvent,
} from "../types/index.js";
import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { BaseSafety } from "../safety/base.js";
import { buildSystemPrompt } from "../prompts/system.js";
import { countInputTokens, countOutputTokens } from "../utils/tokens.js";
import { parseStream } from "./parse-stream.js";

export class AgentLoop extends EventEmitter {
  private messages: Message[] = [];
  private provider: BaseProvider;
  private tools: ToolRegistry;
  private safety: BaseSafety;
  private abortController: AbortController | null = null;
  private systemPrompt: string;

  constructor(provider: BaseProvider, tools: ToolRegistry, safety: BaseSafety) {
    super();
    this.provider = provider;
    this.tools = tools;
    this.safety = safety;
    this.systemPrompt = buildSystemPrompt(process.cwd());
  }

  async sendMessage(text: string): Promise<void> {
    this.messages.push({ role: "user", content: text });
    this.emitEvent({ type: "status_change", status: "thinking" });

    try {
      // Agentic while-loop: keep going until no tool_use blocks
      while (true) {
        // Count input tokens before the LLM call
        const schemas = this.tools.buildSchemas();
        const inputTokens = countInputTokens(this.messages, this.systemPrompt, schemas);

        this.abortController = new AbortController();
        this.emitEvent({ type: "status_change", status: "streaming" });

        const contentBlocks = await parseStream(
          this.provider.stream(
            this.messages,
            this.systemPrompt,
            schemas,
            this.abortController.signal,
          ),
          {
            onTextDelta: (text) => this.emitEvent({ type: "text_delta", text }),
            onTextComplete: (text) => this.emitEvent({ type: "text_complete", text }),
          },
        );

        this.abortController = null;

        // Count output tokens from the response
        const outputTokens = countOutputTokens(contentBlocks);

        // Emit our locally-counted usage
        this.emitEvent({
          type: "usage_update",
          usage: { inputTokens, outputTokens },
        });

        // Build the assistant message from accumulated blocks
        const assistantMessage: Message = { role: "assistant", content: contentBlocks };
        this.messages.push(assistantMessage);
        this.emitEvent({ type: "turn_complete", message: assistantMessage });

        // Collect tool_use blocks
        const toolUses = contentBlocks.filter(
          (b): b is ToolUseBlock => b.type === "tool_use",
        );

        if (toolUses.length === 0) break;

        // Execute tools and build results
        const toolResults: ToolResultBlock[] = [];
        for (const toolUse of toolUses) {
          this.emitEvent({
            type: "tool_executing",
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
          });

          const tool = this.tools.get(toolUse.name);
          let result: string;
          if (!tool) {
            result = `error: unknown tool '${toolUse.name}'`;
          } else {
            // Check safety
            if (this.safety.shouldConfirm(tool, toolUse.input)) {
              const decision = await this.safety.requestConfirmation(tool, toolUse.input);
              if (decision === "deny") {
                result = "error: tool execution denied by user";
              } else {
                result = await tool.execute(toolUse.input);
              }
            } else {
              result = await tool.execute(toolUse.input);
            }
          }

          this.emitEvent({
            type: "tool_result",
            id: toolUse.id,
            name: toolUse.name,
            result,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        // Add tool results as a user message
        this.messages.push({ role: "user", content: toolResults });
        this.emitEvent({ type: "status_change", status: "thinking" });
      }

      this.emitEvent({ type: "loop_complete", messages: this.getMessages() });
      this.emitEvent({ type: "status_change", status: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("aborted")) {
        this.emitEvent({ type: "status_change", status: "idle" });
      } else {
        this.emitEvent({ type: "error", error: message });
        this.emitEvent({ type: "status_change", status: "error" });
      }
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  setMessages(msgs: Message[]): void {
    this.messages = [...msgs];
  }

  clearMessages(): void {
    this.messages = [];
  }

  setProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  getProvider(): BaseProvider {
    return this.provider;
  }

  private emitEvent(event: AgentEvent): void {
    this.emit("event", event);
  }
}
