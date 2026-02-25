import type { ConfirmationDecision } from "../types/index.js";
import type { BaseTool } from "../tools/base.js";

export abstract class BaseSafety {
  abstract shouldConfirm(tool: BaseTool, input: Record<string, unknown>): boolean;
  abstract requestConfirmation(
    tool: BaseTool,
    input: Record<string, unknown>,
  ): Promise<ConfirmationDecision>;
}
