import type { ProviderConfig } from "../types/index.js";

export const PROVIDER_DEFAULTS: Record<string, Omit<ProviderConfig, "apiKey">> = {
  anthropic: {
    name: "anthropic",
    model: "claude-sonnet-4-5",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 8192,
  },
  openai: {
    name: "openai",
    model: "gpt-4o",
    baseUrl: "https://api.openai.com",
    maxTokens: 4096,
  },
  ollama: {
    name: "ollama",
    model: "llama3",
    baseUrl: "http://localhost:11434",
    maxTokens: 4096,
  },
};
