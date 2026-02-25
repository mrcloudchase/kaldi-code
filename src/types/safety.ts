export interface ConfirmationRequest {
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
}

export type ConfirmationDecision = "allow" | "deny" | "allow_always";

export interface SafetyRule {
  toolName: string;
  pattern?: string;
  action: ConfirmationDecision;
}
