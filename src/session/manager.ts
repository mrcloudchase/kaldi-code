import { randomUUID } from "node:crypto";
import type { Session, SessionSummary, Message } from "../types/index.js";
import type { BaseStorage } from "./base.js";

export class SessionManager {
  private currentSession: Session;

  constructor(
    private storage: BaseStorage,
    provider: string,
    model: string,
    sessionId?: string,
  ) {
    this.currentSession = {
      id: sessionId ?? randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider,
      model,
      messages: [],
      cwd: process.cwd(),
    };
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  getSessionId(): string {
    return this.currentSession.id;
  }

  async save(messages: Message[], provider: string, model: string): Promise<void> {
    this.currentSession.messages = messages;
    this.currentSession.provider = provider;
    this.currentSession.model = model;
    this.currentSession.updatedAt = new Date().toISOString();
    await this.storage.save(this.currentSession);
  }

  async load(id: string): Promise<Session> {
    const session = await this.storage.load(id);
    this.currentSession = session;
    return session;
  }

  async list(): Promise<SessionSummary[]> {
    return this.storage.list();
  }

  async delete(id: string): Promise<void> {
    return this.storage.delete(id);
  }
}
