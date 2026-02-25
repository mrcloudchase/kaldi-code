import React from "react";
import { Box, Text } from "ink";

interface StreamingTextProps {
  text: string;
}

export function StreamingText({ text }: StreamingTextProps) {
  if (!text) return null;

  return (
    <Box>
      <Text color="yellow">🐕 </Text>
      <Text>{text}</Text>
    </Box>
  );
}
