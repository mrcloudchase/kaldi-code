import type { StreamEvent, Message, ToolSchema } from "../types/index.js";
import { BaseProvider } from "./base.js";

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  readonly supportsTools = true;

  private formatTools(tools: ToolSchema[]): unknown {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  private formatMessages(messages: Message[], systemPrompt: string): unknown {
    const formatted: Record<string, unknown>[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        formatted.push({ role: msg.role, content: msg.content });
      } else {
        // Convert ContentBlock[] to OpenAI format
        if (msg.role === "assistant") {
          const textParts: string[] = [];
          const toolCalls: Record<string, unknown>[] = [];

          for (const block of msg.content) {
            if (block.type === "text") {
              textParts.push(block.text);
            } else if (block.type === "tool_use") {
              toolCalls.push({
                id: block.id,
                type: "function",
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              });
            }
          }

          const entry: Record<string, unknown> = { role: "assistant" };
          if (textParts.length > 0) entry.content = textParts.join("\n");
          if (toolCalls.length > 0) entry.tool_calls = toolCalls;
          formatted.push(entry);
        } else {
          // user role with tool results
          for (const block of msg.content) {
            if (block.type === "tool_result") {
              formatted.push({
                role: "tool",
                tool_call_id: block.tool_use_id,
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
      max_tokens: this.config.maxTokens,
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey ?? ""}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const reader = response.body!.getReader();
    const activeToolCalls = new Map<number, { id: string; name: string; args: string }>();
    let messageId = "";

    for await (const { data } of this.parseSSE(reader)) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (!messageId && parsed.id) {
        messageId = parsed.id as string;
        yield { type: "message_start", messageId };
      }

      const choices = parsed.choices as Record<string, unknown>[] | undefined;
      if (!choices?.[0]) continue;

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;
      const finishReason = choice.finish_reason as string | null;

      if (delta) {
        // Text content
        if (delta.content) {
          yield { type: "text_delta", text: delta.content as string };
        }

        // Tool calls
        const toolCalls = delta.tool_calls as Record<string, unknown>[] | undefined;
        if (toolCalls) {
          for (const tc of toolCalls) {
            const index = tc.index as number;
            const fn = tc.function as Record<string, unknown> | undefined;

            if (tc.id) {
              // New tool call starting
              activeToolCalls.set(index, {
                id: tc.id as string,
                name: fn?.name as string ?? "",
                args: "",
              });
              yield { type: "tool_use_start", id: tc.id as string, name: fn?.name as string ?? "" };
            }

            if (fn?.arguments) {
              const call = activeToolCalls.get(index);
              if (call) {
                call.args += fn.arguments as string;
                yield { type: "tool_input_delta", id: call.id, partialJson: fn.arguments as string };
              }
            }
          }
        }
      }

      if (finishReason) {
        // Emit tool_use_end for all accumulated tool calls
        for (const [, call] of activeToolCalls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(call.args);
          } catch {}
          yield { type: "tool_use_end", id: call.id, input };
        }
        activeToolCalls.clear();

        const usage = parsed.usage as Record<string, number> | undefined;
        yield {
          type: "message_end",
          stopReason: finishReason,
          usage: {
            inputTokens: usage?.prompt_tokens ?? 0,
            outputTokens: usage?.completion_tokens ?? 0,
          },
        };
      }
    }
  }
}
