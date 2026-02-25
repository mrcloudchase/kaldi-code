import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

interface PlanItem {
  text: string;
  done: boolean;
}

interface Plan {
  title: string;
  items: PlanItem[];
}

export class PlanTool extends BaseTool {
  readonly name = "plan";
  readonly description =
    "Create or update a plan with todo items. The plan is a markdown checklist that persists in the session. Use actions: 'create' to start a new plan, 'add' to add items, 'check' to mark items complete, 'uncheck' to unmark, 'view' to see current plan, 'clear' to reset.";
  readonly params: ToolParam[] = [
    { name: "action", type: "string", description: "One of: create, add, check, uncheck, view, clear", required: true },
    { name: "content", type: "string", description: "Plan title (for create), item text (for add), or item number (for check/uncheck)", required: false },
  ];
  readonly safety = "safe" as const;

  private plan: Plan | null = null;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const action = input.action as string;
    const content = input.content as string | undefined;

    switch (action) {
      case "create":
        this.plan = { title: content ?? "Plan", items: [] };
        return this.render();
      case "add":
        if (!this.plan) return "error: No plan exists. Use action 'create' first.";
        this.plan.items.push({ text: content ?? "", done: false });
        return this.render();
      case "check":
        return this.toggleItem(parseInt(content ?? "0", 10) - 1, true);
      case "uncheck":
        return this.toggleItem(parseInt(content ?? "0", 10) - 1, false);
      case "view":
        return this.plan ? this.render() : "No plan exists.";
      case "clear":
        this.plan = null;
        return "Plan cleared.";
      default:
        return `error: Unknown action '${action}'. Use: create, add, check, uncheck, view, clear`;
    }
  }

  private toggleItem(index: number, done: boolean): string {
    if (!this.plan) return "error: No plan exists.";
    if (index < 0 || index >= this.plan.items.length) {
      return `error: Invalid item number. Plan has ${this.plan.items.length} items.`;
    }
    this.plan.items[index]!.done = done;
    return this.render();
  }

  private render(): string {
    if (!this.plan) return "No plan exists.";
    const header = `# ${this.plan.title}\n`;
    const items = this.plan.items
      .map((item, i) => `${i + 1}. [${item.done ? "x" : " "}] ${item.text}`)
      .join("\n");
    const progress =
      this.plan.items.length > 0
        ? `\n\n${this.plan.items.filter((i) => i.done).length}/${this.plan.items.length} complete`
        : "";
    return header + items + progress;
  }
}
