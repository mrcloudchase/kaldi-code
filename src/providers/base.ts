import type { ProviderConfig, StreamEvent, Message, ToolSchema } from "../types/index.js";

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly supportsTools: boolean;

  constructor(protected config: ProviderConfig) {}

  get model(): string {
    return this.config.model;
  }

  get maxTokens(): number {
    return this.config.maxTokens;
  }

  abstract stream(
    messages: Message[],
    systemPrompt: string,
    tools: ToolSchema[],
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent>;

  protected async *parseSSE(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): AsyncGenerator<{ event: string; data: string }> {
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "message";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield { event: currentEvent, data };
          currentEvent = "message";
        }
      }
    }
  }
}
