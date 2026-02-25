import type { StreamEvent, Message, ToolSchema, ContentBlock } from "../types/index.js";
import { BaseProvider } from "./base.js";

export class OllamaProvider extends BaseProvider {
  readonly name = "ollama";
  readonly supportsTools = true;

  formatTools(tools: ToolSchema[]): unknown {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  formatMessages(messages: Message[], systemPrompt: string): unknown {
    const formatted: Record<string, unknown>[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        formatted.push({ role: msg.role, content: msg.content });
      } else {
        if (msg.role === "assistant") {
          const textParts: string[] = [];
          const toolCalls: Record<string, unknown>[] = [];

          for (const block of msg.content) {
            if (block.type === "text") {
              textParts.push(block.text);
            } else if (block.type === "tool_use") {
              toolCalls.push({
                function: {
                  name: block.name,
                  arguments: block.input,
                },
              });
            }
          }

          const entry: Record<string, unknown> = { role: "assistant" };
          if (textParts.length > 0) entry.content = textParts.join("\n");
          if (toolCalls.length > 0) entry.tool_calls = toolCalls;
          formatted.push(entry);
        } else {
          for (const block of msg.content) {
            if (block.type === "tool_result") {
              formatted.push({
                role: "tool",
                content: block.content,
              });
            } else if (block.type === "text") {
              formatted.push({ role: "user", content: block.text });
            }
          }
        }
      }
    }

    return formatted;
  }

  async *stream(
    messages: Message[],
    systemPrompt: string,
    tools: ToolSchema[],
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const formattedMessages = this.formatMessages(messages, systemPrompt);
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: formattedMessages,
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${text}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let messageId = `ollama-${Date.now()}`;
    let yieldedStart = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (!yieldedStart) {
          yield { type: "message_start", messageId };
          yieldedStart = true;
        }

        const msg = parsed.message as Record<string, unknown> | undefined;

        if (msg?.content) {
          yield { type: "text_delta", text: msg.content as string };
        }

        // Handle tool calls in Ollama response
        const toolCalls = msg?.tool_calls as Record<string, unknown>[] | undefined;
        if (toolCalls) {
          for (const tc of toolCalls) {
            const fn = tc.function as Record<string, unknown>;
            const id = `ollama-tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const name = fn.name as string;
            const args = fn.arguments as Record<string, unknown>;

            yield { type: "tool_use_start", id, name };
            yield { type: "tool_input_delta", id, partialJson: JSON.stringify(args) };
            yield { type: "tool_use_end", id, input: args };
          }
        }

        if (parsed.done) {
          const evalCount = (parsed.eval_count as number) ?? 0;
          const promptEvalCount = (parsed.prompt_eval_count as number) ?? 0;
          yield {
            type: "message_end",
            stopReason: toolCalls ? "tool_use" : "end_turn",
            usage: { inputTokens: promptEvalCount, outputTokens: evalCount },
          };
        }
      }
    }
  }
}
