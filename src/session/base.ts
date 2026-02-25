import type { Session, SessionSummary } from "../types/index.js";

export abstract class BaseStorage {
  abstract initialize(): Promise<void>;
  abstract save(session: Session): Promise<void>;
  abstract load(id: string): Promise<Session>;
  abstract list(): Promise<SessionSummary[]>;
  abstract delete(id: string): Promise<void>;
}
