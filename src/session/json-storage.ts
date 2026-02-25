import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Session, SessionSummary, Message } from "../types/index.js";
import { BaseStorage } from "./base.js";

export class JsonFileStorage extends BaseStorage {
  constructor(private dir: string) {
    super();
  }

  async initialize(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async save(session: Session): Promise<void> {
    const filePath = join(this.dir, `${session.id}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  }

  async load(id: string): Promise<Session> {
    const filePath = join(this.dir, `${id}.json`);
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as Session;
  }

  async list(): Promise<SessionSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch {
      return [];
    }

    const summaries: SessionSummary[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const data = await readFile(join(this.dir, entry), "utf-8");
        const session = JSON.parse(data) as Session;
        summaries.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          provider: session.provider,
          model: session.model,
          messageCount: session.messages.length,
          preview: this.getPreview(session.messages),
        });
      } catch {
        // Skip corrupted files
      }
    }

    // Sort newest first
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
  }

  async delete(id: string): Promise<void> {
    const filePath = join(this.dir, `${id}.json`);
    await unlink(filePath);
  }

  private getPreview(messages: Message[]): string {
    const firstUser = messages.find(
      (m) => m.role === "user" && typeof m.content === "string",
    );
    if (!firstUser || typeof firstUser.content !== "string") return "(empty)";
    return firstUser.content.slice(0, 80);
  }
}
