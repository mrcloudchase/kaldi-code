import type { ContentBlock, ToolUseBlock, StreamEvent } from "../types/index.js";

export interface StreamCallbacks {
  onTextDelta?(text: string): void;
  onTextComplete?(text: string): void;
}

export async function parseStream(
  events: AsyncIterable<StreamEvent>,
  callbacks?: StreamCallbacks,
): Promise<ContentBlock[]> {
  const contentBlocks: ContentBlock[] = [];
  let currentText = "";
  let currentToolUse: ToolUseBlock | null = null;
  let jsonAccumulator = "";

  for await (const event of events) {
    switch (event.type) {
      case "text_delta":
        currentText += event.text;
        callbacks?.onTextDelta?.(event.text);
        break;

      case "tool_use_start":
        if (currentText) {
          contentBlocks.push({ type: "text", text: currentText });
          callbacks?.onTextComplete?.(currentText);
          currentText = "";
        }
        currentToolUse = {
          type: "tool_use",
          id: event.id,
          name: event.name,
          input: {},
        };
        jsonAccumulator = "";
        break;

      case "tool_input_delta":
        jsonAccumulator += event.partialJson;
        break;

      case "tool_use_end":
        if (currentToolUse) {
          currentToolUse.input = event.input;
          contentBlocks.push(currentToolUse);
          currentToolUse = null;
          jsonAccumulator = "";
        }
        break;

      case "message_end":
        break;
    }
  }

  // Flush remaining text
  if (currentText) {
    contentBlocks.push({ type: "text", text: currentText });
    callbacks?.onTextComplete?.(currentText);
  }

  return contentBlocks;
}
