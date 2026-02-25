import type { ConfirmationDecision } from "../types/index.js";
import type { BaseTool } from "../tools/base.js";
import { BaseSafety } from "./base.js";

export class PassthroughSafety extends BaseSafety {
  shouldConfirm(_tool: BaseTool, _input: Record<string, unknown>): boolean {
    return false;
  }

  async requestConfirmation(
    _tool: BaseTool,
    _input: Record<string, unknown>,
  ): Promise<ConfirmationDecision> {
    return "allow";
  }
}
