export interface ProviderConfig {
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_input_delta"; id: string; partialJson: string }
  | { type: "tool_use_end"; id: string; input: Record<string, unknown> }
  | { type: "message_start"; messageId: string }
  | { type: "message_end"; stopReason: string; usage: TokenUsage };
