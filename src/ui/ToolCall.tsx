import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";
import { inputPreview, resultPreview } from "./format.js";

interface ToolCallProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isExecuting: boolean;
}

export function ToolCall({ name, input, result, isExecuting }: ToolCallProps) {
  const preview = inputPreview(input);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="yellow">🐾 {name}</Text>
        <Text dimColor>("{preview}")</Text>
      </Box>
      {isExecuting && (
        <Box marginLeft={2}>
          <Spinner label="…" />
        </Box>
      )}
      {result !== undefined && (
        <Box marginLeft={2}>
          <Text dimColor>🦴 {resultPreview(result)}</Text>
        </Box>
      )}
    </Box>
  );
}

