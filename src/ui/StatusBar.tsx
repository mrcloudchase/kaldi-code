import React from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "../types/index.js";

interface StatusBarProps {
  provider: string;
  model: string;
  usage: TokenUsage;
  sessionId: string;
}

export function StatusBar({ provider, model, usage, sessionId }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        {provider}/{model} | {usage.inputTokens}↑ {usage.outputTokens}↓ | {sessionId}
      </Text>
    </Box>
  );
}
