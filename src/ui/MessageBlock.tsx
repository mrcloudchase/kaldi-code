import React from "react";
import { Box, Text } from "ink";
import type { Message, ContentBlock } from "../types/index.js";
import { inputPreview, resultPreview } from "./format.js";

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
          const preview = inputPreview(block.input, 50);
          const result = turn.toolResults.get(block.id);
          return (
            <Box key={i} flexDirection="column">
              <Box>
                <Text color="yellow">🐾 {block.name}</Text>
                <Text dimColor>("{preview}")</Text>
              </Box>
              {result !== undefined && (
                <Box marginLeft={2}>
                  <Text dimColor>🦴 {resultPreview(result, 60)}</Text>
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
