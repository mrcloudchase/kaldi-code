import type { BaseProvider } from "../providers/base.js";
import { BaseTool } from "./base.js";

export abstract class LLMTool extends BaseTool {
  constructor(protected providerFactory: () => BaseProvider) {
    super();
  }

  protected async llmCall(prompt: string, systemPrompt?: string): Promise<string> {
    const provider = this.providerFactory();
    let result = "";
    for await (const event of provider.stream(
      [{ role: "user", content: prompt }],
      systemPrompt ?? "You are a helpful assistant. Be concise.",
      [],
      new AbortController().signal,
    )) {
      if (event.type === "text_delta") result += event.text;
    }
    return result;
  }
}
