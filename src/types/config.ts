export interface AppConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature?: number;
  sessionDir: string;
  sessionId?: string;
}
