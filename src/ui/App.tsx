import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { AgentLoop } from "../agent/loop.js";
import type { SessionManager } from "../session/manager.js";
import type { AppConfig } from "../types/index.js";
import { MessageList } from "./MessageList.js";
import { StreamingText } from "./StreamingText.js";
import { ToolCall } from "./ToolCall.js";
import { Spinner } from "./Spinner.js";
import { StatusBar } from "./StatusBar.js";
import { useAgent } from "./hooks/useAgent.js";
import type { LoopDisplayItem } from "./hooks/useAgent.js";
import { useCommands } from "./hooks/useCommands.js";

interface AppProps {
  agentLoop: AgentLoop;
  sessionManager: SessionManager;
  config: AppConfig;
}

export function App({ agentLoop, sessionManager, config }: AppProps) {
  const { exit } = useApp();
  const {
    status,
    streamingText,
    completedTurns,
    currentUserMessage,
    loopDisplay,
    activeToolCall,
    totalUsage,
    pendingMessage,
    sendMessage,
    clearConversation,
    cancelPending,
  } = useAgent(agentLoop);

  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const commandHandlers = useMemo(
    () => ({
      clearConversation,
      onExit: () => exit(),
      agentLoop,
      sessionManager,
      setOutput: (text: string) => setCommandOutput(text),
    }),
    [clearConversation, exit, agentLoop, sessionManager],
  );

  const { handleInput: handleCommand } = useCommands(commandHandlers);

  const handleSubmit = useCallback(
    (text: string) => {
      setCommandOutput(null);
      if (!handleCommand(text)) {
        sendMessage(text);
      }
    },
    [handleCommand, sendMessage],
  );

  useInput((input, key) => {
    if (key.escape && pendingMessage) {
      const text = cancelPending();
      if (text) {
        setInputValue(text);
      }
    }
  });

  const isRunning = status !== "idle" && status !== "error";
  const provider = agentLoop.getProvider();

  return (
    <Box flexDirection="column">
      {/* Static: header + completed turns (rendered once, never re-rendered) */}
      <MessageList
        turns={completedTurns}
        provider={provider.name}
        model={provider.model}
        cwd={process.cwd()}
      />

      {/* Command output */}
      {commandOutput && (
        <Box marginLeft={1}>
          <Text>{commandOutput}</Text>
        </Box>
      )}

      {/* Dynamic: current agentic loop in progress */}
      {isRunning && (
        <Box flexDirection="column">
          {/* Show the user message that started this loop */}
          {currentUserMessage && (
            <>
              <Text>{" "}</Text>
              <Box>
                <Text color="blue" bold>{"❯ "}</Text>
                <Text>{currentUserMessage}</Text>
              </Box>
            </>
          )}

          {/* Accumulated completed items from this loop */}
          {loopDisplay.map((item, i) => {
            if (item.kind === "text") {
              return (
                <Box key={`text-${i}`}>
                  <Text color="yellow">🐕 </Text>
                  <Text>{item.text}</Text>
                </Box>
              );
            }
            if (item.kind === "tool") {
              return (
                <Box key={`tool-${item.id}`} marginLeft={1}>
                  <ToolCall
                    name={item.name}
                    input={item.input}
                    result={item.result}
                    isExecuting={false}
                  />
                </Box>
              );
            }
            return null;
          })}

          {/* Currently executing tool */}
          {activeToolCall && (
            <Box marginLeft={1}>
              <ToolCall
                name={activeToolCall.name}
                input={activeToolCall.input}
                isExecuting={true}
              />
            </Box>
          )}

          {/* Live streaming text */}
          {streamingText && (
            <Box marginLeft={1}>
              <StreamingText text={streamingText} />
            </Box>
          )}

          {/* Animated status — show when agent is working and nothing else is visible */}
          {!streamingText && !activeToolCall && (
            <Box marginLeft={1}>
              <Spinner />
            </Box>
          )}
        </Box>
      )}

      {/* Input area — always visible */}
      <Box flexDirection="column">
        <Text dimColor>{"─".repeat(60)}</Text>
        <Box>
          <Text color="blue" bold>{"❯ "}</Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={(val) => {
              if (val.trim()) {
                handleSubmit(val.trim());
                setInputValue("");
              }
            }}
          />
        </Box>
        {pendingMessage && (
          <Text dimColor>{"  queued: "}{pendingMessage} <Text dimColor>(ESC to edit)</Text></Text>
        )}
        <Text dimColor>{"─".repeat(60)}</Text>
      </Box>

      <StatusBar
        provider={provider.name}
        model={provider.model}
        usage={totalUsage}
        sessionId={sessionManager.getSessionId()}
      />
    </Box>
  );
}
