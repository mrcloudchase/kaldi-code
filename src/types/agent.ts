import type { ContentBlock, Message } from "./messages.js";
import type { TokenUsage } from "./provider.js";

export type AgentStatus = "idle" | "thinking" | "streaming" | "tool_executing" | "error";

export type AgentEvent =
  | { type: "status_change"; status: AgentStatus }
  | { type: "text_delta"; text: string }
  | { type: "text_complete"; text: string }
  | { type: "tool_executing"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "turn_complete"; message: Message }
  | { type: "loop_complete"; messages: Message[] }
  | { type: "usage_update"; usage: TokenUsage }
  | { type: "error"; error: string };

export interface AgentState {
  status: AgentStatus;
  messages: Message[];
  streamingText: string;
  activeToolCalls: Map<string, { name: string; input: Record<string, unknown> }>;
  totalUsage: TokenUsage;
}
