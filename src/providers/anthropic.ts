import type { StreamEvent, Message, ToolSchema } from "../types/index.js";
import { BaseProvider } from "./base.js";

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic";
  readonly supportsTools = true;

  private formatTools(tools: ToolSchema[]): unknown {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  private formatMessages(messages: Message[], systemPrompt: string): unknown {
    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };
  }

  async *stream(
    messages: Message[],
    systemPrompt: string,
    tools: ToolSchema[],
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const body = this.formatMessages(messages, systemPrompt) as Record<string, unknown>;
    if (tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const reader = response.body!.getReader();
    let currentToolId = "";
    let currentToolName = "";
    let jsonAccumulator = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const { event, data } of this.parseSSE(reader)) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      switch (event) {
        case "message_start": {
          const msg = parsed.message as Record<string, unknown>;
          const usage = msg.usage as Record<string, number>;
          inputTokens = usage.input_tokens ?? 0;
          yield { type: "message_start", messageId: (msg.id as string) ?? "" };
          break;
        }

        case "content_block_start": {
          const block = parsed.content_block as Record<string, unknown>;
          if (block.type === "tool_use") {
            currentToolId = block.id as string;
            currentToolName = block.name as string;
            jsonAccumulator = "";
            yield { type: "tool_use_start", id: currentToolId, name: currentToolName };
          }
          break;
        }

        case "content_block_delta": {
          const delta = parsed.delta as Record<string, unknown>;
          if (delta.type === "text_delta") {
            yield { type: "text_delta", text: delta.text as string };
          } else if (delta.type === "input_json_delta") {
            const partial = delta.partial_json as string;
            jsonAccumulator += partial;
            yield { type: "tool_input_delta", id: currentToolId, partialJson: partial };
          }
          break;
        }

        case "content_block_stop": {
          if (currentToolId) {
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(jsonAccumulator);
            } catch {}
            yield { type: "tool_use_end", id: currentToolId, input };
            currentToolId = "";
            currentToolName = "";
            jsonAccumulator = "";
          }
          break;
        }

        case "message_delta": {
          const delta = parsed.delta as Record<string, unknown>;
          const usage = parsed.usage as Record<string, number> | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
          yield {
            type: "message_end",
            stopReason: (delta.stop_reason as string) ?? "end_turn",
            usage: { inputTokens, outputTokens },
          };
          break;
        }
      }
    }
  }
}
