import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  provider: string;
  model: string;
  cwd: string;
}

const BANNER = `
    / \\__
   (    @\\___    ██╗  ██╗ █████╗ ██╗     ██████╗ ██╗
   /         O   ██║ ██╔╝██╔══██╗██║     ██╔══██╗██║
  /   (_____/    █████╔╝ ███████║██║     ██║  ██║██║
 /_____/   U     ██╔═██╗ ██╔══██║██║     ██║  ██║██║
                 ██║  ██╗██║  ██║███████╗██████╔╝██║
                 ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝`;

export function Header({ provider, model, cwd }: HeaderProps) {
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>
        {BANNER}
      </Text>
      <Text dimColor>
        {provider}/{model} | {cwd}
      </Text>
      <Text dimColor>{"─".repeat(70)}</Text>
    </Box>
  );
}
