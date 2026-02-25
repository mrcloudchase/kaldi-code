import type { AppConfig } from "../types/index.js";
import { PROVIDER_DEFAULTS } from "./defaults.js";
import { join } from "node:path";
import { homedir } from "node:os";

export function loadConfig(args: string[]): AppConfig {
  const provider = getArg(args, "--provider") ?? process.env.KALDI_PROVIDER ?? "anthropic";
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.anthropic!;

  return {
    provider,
    model: getArg(args, "--model") ?? process.env.KALDI_MODEL ?? defaults.model,
    apiKey: getApiKey(provider),
    baseUrl: getArg(args, "--base-url") ?? defaults.baseUrl,
    maxTokens: parseInt(getArg(args, "--max-tokens") ?? String(defaults.maxTokens), 10),
    temperature: parseOptionalFloat(getArg(args, "--temperature")),
    sessionDir: getArg(args, "--session-dir") ?? join(homedir(), ".kaldi-code", "sessions"),
    sessionId: getArg(args, "--session"),
  };
}

function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    default:
      return undefined;
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
}
