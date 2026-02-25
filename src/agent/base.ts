import { EventEmitter } from "node:events";
import type { Message, AgentEvent } from "../types/index.js";
import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { BaseSafety } from "../safety/base.js";

export abstract class BaseAgent extends EventEmitter {
  protected messages: Message[] = [];
  protected provider: BaseProvider;
  protected tools: ToolRegistry;
  protected safety: BaseSafety;

  constructor(provider: BaseProvider, tools: ToolRegistry, safety: BaseSafety) {
    super();
    this.provider = provider;
    this.tools = tools;
    this.safety = safety;
  }

  abstract sendMessage(text: string): Promise<void>;
  abstract abort(): void;

  getMessages(): Message[] {
    return [...this.messages];
  }

  setMessages(msgs: Message[]): void {
    this.messages = [...msgs];
  }

  clearMessages(): void {
    this.messages = [];
  }

  setProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  getProvider(): BaseProvider {
    return this.provider;
  }

  protected emitEvent(event: AgentEvent): void {
    this.emit("event", event);
  }
}
