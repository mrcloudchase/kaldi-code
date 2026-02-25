import { get_encoding, type Tiktoken } from "@dqbd/tiktoken";
import type { Message, ContentBlock, ToolSchema } from "../types/index.js";

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = get_encoding("cl100k_base");
  }
  return encoder;
}

/** Count tokens in a plain string. */
export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

/** Count tokens for the full input to an LLM call: system prompt + messages + tool schemas. */
export function countInputTokens(
  messages: Message[],
  systemPrompt: string,
  tools: ToolSchema[],
): number {
  let total = 0;

  // System prompt
  total += countTokens(systemPrompt);

  // Messages
  for (const msg of messages) {
    total += 4; // message overhead (role, separators)
    if (typeof msg.content === "string") {
      total += countTokens(msg.content);
    } else {
      for (const block of msg.content) {
        total += countBlockTokens(block);
      }
    }
  }

  // Tool schemas
  if (tools.length > 0) {
    total += countTokens(JSON.stringify(tools));
  }

  return total;
}

/** Count tokens in the assistant's output content blocks. */
export function countOutputTokens(blocks: ContentBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    total += countBlockTokens(block);
  }
  return total;
}

function countBlockTokens(block: ContentBlock): number {
  switch (block.type) {
    case "text":
      return countTokens(block.text);
    case "tool_use":
      return countTokens(block.name) + countTokens(JSON.stringify(block.input));
    case "tool_result":
      return countTokens(block.content);
  }
}

/** Clean up the encoder when done (e.g., on process exit). */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}
