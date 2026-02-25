import type { BaseProvider } from "../providers/base.js";
import { ToolRegistry } from "./registry.js";
import { ReadTool } from "./read.js";
import { WriteTool } from "./write.js";
import { EditTool } from "./edit.js";
import { GlobTool } from "./glob.js";
import { GrepTool } from "./grep.js";
import { BashTool } from "./bash.js";
import { WebSearchTool } from "./web-search.js";
import { WebFetchTool } from "./web-fetch.js";
import { PlanTool } from "./plan.js";
import { DelegateTool } from "./delegate.js";

export { BaseTool } from "./base.js";
export { LLMTool } from "./llm-tool.js";
export { ToolRegistry } from "./registry.js";
export { ReadTool } from "./read.js";
export { WriteTool } from "./write.js";
export { EditTool } from "./edit.js";
export { GlobTool } from "./glob.js";
export { GrepTool } from "./grep.js";
export { BashTool } from "./bash.js";
export { WebSearchTool } from "./web-search.js";
export { WebFetchTool } from "./web-fetch.js";
export { PlanTool } from "./plan.js";
export { DelegateTool } from "./delegate.js";

export function createToolRegistry(providerFactory: () => BaseProvider): ToolRegistry {
  const registry = new ToolRegistry();

  // File/system tools
  registry.register(new ReadTool());
  registry.register(new WriteTool());
  registry.register(new EditTool());
  registry.register(new GlobTool());
  registry.register(new GrepTool());
  registry.register(new BashTool());

  // Web tools
  registry.register(new WebSearchTool());
  registry.register(new WebFetchTool(providerFactory));

  // Planning tool
  registry.register(new PlanTool());

  // Delegation tool (needs registry reference for sub-agent tool filtering)
  registry.register(new DelegateTool(providerFactory, registry));

  return registry;
}
