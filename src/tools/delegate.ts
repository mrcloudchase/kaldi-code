import type { ToolParam } from "../types/index.js";
import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "./registry.js";
import { LLMTool } from "./llm-tool.js";

// Forward declaration — SubAgentRunner is imported dynamically to avoid circular deps
type SubAgentRunnerType = import("../agent/sub-agent.js").SubAgentRunner;

export class DelegateTool extends LLMTool {
  readonly name = "delegate";
  readonly description =
    "Delegate a self-contained task to a sub-agent. The sub-agent runs with its own context window and returns a result. Use this for tasks that require exploration or multi-step work but whose intermediate steps don't need to persist in the main conversation.";
  readonly params: ToolParam[] = [
    { name: "task", type: "string", description: "Clear description of the task to delegate", required: true },
    { name: "tools", type: "string", description: "Comma-separated tool names the sub-agent should have access to (default: all except delegate)", required: false },
  ];
  readonly safety = "safe" as const;

  private toolRegistry: ToolRegistry;

  constructor(providerFactory: () => BaseProvider, toolRegistry: ToolRegistry) {
    super(providerFactory);
    this.toolRegistry = toolRegistry;
  }

  protected async run(input: Record<string, unknown>): Promise<string> {
    const task = input.task as string;
    const allowedTools = input.tools
      ? (input.tools as string).split(",").map((s) => s.trim())
      : undefined;

    // Sub-agents get all tools EXCEPT delegate (no recursive sub-agents)
    const subTools = this.toolRegistry.without("delegate");
    const filteredTools = allowedTools ? subTools.filter(allowedTools) : subTools;

    // Dynamic import to avoid circular dependency
    const { SubAgentRunner } = await import("../agent/sub-agent.js");
    const { PassthroughSafety } = await import("../safety/passthrough.js");

    const subAgent = new SubAgentRunner(
      this.providerFactory(),
      filteredTools,
      new PassthroughSafety(),
      { maxTurns: 10 },
    );

    return await subAgent.run(task);
  }
}
