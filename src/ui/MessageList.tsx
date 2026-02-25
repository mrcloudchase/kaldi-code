import React from "react";
import { Static } from "ink";
import { Header } from "./Header.js";
import { MessageBlock } from "./MessageBlock.js";
import type { CompletedTurn } from "./MessageBlock.js";

type StaticItem =
  | { kind: "header"; provider: string; model: string; cwd: string }
  | { kind: "turn"; turn: CompletedTurn };

interface MessageListProps {
  turns: CompletedTurn[];
  provider: string;
  model: string;
  cwd: string;
}

export function MessageList({ turns, provider, model, cwd }: MessageListProps) {
  const items: StaticItem[] = [
    { kind: "header", provider, model, cwd },
    ...turns.map((turn): StaticItem => ({ kind: "turn", turn })),
  ];

  return (
    <Static items={items}>
      {(item, index) =>
        item.kind === "header" ? (
          <Header
            key="header"
            provider={item.provider}
            model={item.model}
            cwd={item.cwd}
          />
        ) : (
          <MessageBlock key={index} turn={item.turn} />
        )
      }
    </Static>
  );
}
