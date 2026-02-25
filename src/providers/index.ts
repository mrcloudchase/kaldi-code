import type { ProviderConfig } from "../types/index.js";
import { BaseProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { OllamaProvider } from "./ollama.js";

export { BaseProvider } from "./base.js";
export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { OllamaProvider } from "./ollama.js";

export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.name) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.name}`);
  }
}
