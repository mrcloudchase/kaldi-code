import React from "react";
import { Box, Text } from "ink";
import type { Message, ContentBlock } from "../types/index.js";

interface CompletedTurn {
  userMessage: string;
  assistantBlocks: ContentBlock[];
  toolResults: Map<string, string>;
}

interface MessageBlockProps {
  turn: CompletedTurn;
}

export function MessageBlock({ turn }: MessageBlockProps) {
  return (
    <Box flexDirection="column">
      <Text>{" "}</Text>
      <Box>
        <Text color="blue" bold>{"❯ "}</Text>
        <Text>{turn.userMessage}</Text>
      </Box>
      {turn.assistantBlocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <Box key={i}>
              <Text color="yellow">🐕 </Text>
              <Text>{block.text}</Text>
            </Box>
          );
        }
        if (block.type === "tool_use") {
          const preview = getInputPreview(block.input);
          const result = turn.toolResults.get(block.id);
          return (
            <Box key={i} flexDirection="column">
              <Box>
                <Text color="yellow">🐾 {block.name}</Text>
                <Text dimColor>("{preview}")</Text>
              </Box>
              {result !== undefined && (
                <Box marginLeft={2}>
                  <Text dimColor>🦴 {formatResultPreview(result)}</Text>
                </Box>
              )}
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
}

export type { CompletedTurn };

function getInputPreview(input: Record<string, unknown>): string {
  const firstValue = Object.values(input)[0];
  if (firstValue === undefined) return "";
  const str = String(firstValue);
  return str.length > 50 ? str.slice(0, 47) + "..." : str;
}

function formatResultPreview(result: string): string {
  const lines = result.split("\n");
  const firstLine = lines[0] ?? "";
  const preview = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
  return lines.length > 1 ? `${preview} +${lines.length - 1} lines` : preview;
}
