import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface SpinnerProps {
  label?: string;
}

const MESSAGES = [
  "zooming",
  "sniffing around",
  "fetching sticks",
  "digging deeper",
  "chasing tail",
  "on the scent",
];

export function Spinner({ label }: SpinnerProps) {
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * MESSAGES.length));
  const [charIndex, setCharIndex] = useState(0);

  const text = label ?? MESSAGES[msgIndex % MESSAGES.length]!;

  useEffect(() => {
    // Reset char index when text changes
    setCharIndex(0);
  }, [text]);

  useEffect(() => {
    if (charIndex <= text.length) {
      const timer = setTimeout(() => {
        setCharIndex((c) => c + 1);
      }, 50);
      return () => clearTimeout(timer);
    }

    // Once fully revealed, pause then move to next message (only if using random messages)
    if (!label) {
      const timer = setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [charIndex, text.length, label]);

  const revealed = text.slice(0, charIndex);
  const hidden = text.slice(charIndex);

  return (
    <Box>
      <Text color="yellow">{"🐕 "}</Text>
      <Text color="yellow">{revealed}</Text>
      <Text color="yellow" dimColor>{hidden}</Text>
    </Box>
  );
}
