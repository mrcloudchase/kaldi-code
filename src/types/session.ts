import type { Message } from "./messages.js";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: Message[];
  cwd: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messageCount: number;
  preview: string;
}
