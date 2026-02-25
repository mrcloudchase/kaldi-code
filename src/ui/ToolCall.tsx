import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";

interface ToolCallProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isExecuting: boolean;
}

export function ToolCall({ name, input, result, isExecuting }: ToolCallProps) {
  const preview = getInputPreview(input);

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
          <Text dimColor>🦴 {formatResult(result)}</Text>
        </Box>
      )}
    </Box>
  );
}

function getInputPreview(input: Record<string, unknown>): string {
  const firstValue = Object.values(input)[0];
  if (firstValue === undefined) return "";
  const str = String(firstValue);
  return str.length > 60 ? str.slice(0, 57) + "..." : str;
}

function formatResult(result: string): string {
  const lines = result.split("\n");
  const firstLine = lines[0] ?? "";
  const preview = firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine;
  return lines.length > 1 ? `${preview} +${lines.length - 1} lines` : preview;
}
