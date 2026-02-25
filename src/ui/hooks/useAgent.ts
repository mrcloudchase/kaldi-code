import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentEvent, AgentStatus, TokenUsage, Message, ContentBlock, ToolUseBlock, ToolResultBlock } from "../../types/index.js";
import type { AgentLoop } from "../../agent/loop.js";
import type { CompletedTurn } from "../MessageBlock.js";

// A display item that has finished and should persist in the dynamic area
// until the loop completes and everything moves to Static
export type LoopDisplayItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; result: string };

interface UseAgentReturn {
  status: AgentStatus;
  streamingText: string;
  completedTurns: CompletedTurn[];
  currentUserMessage: string;
  loopDisplay: LoopDisplayItem[];
  activeToolCall: { id: string; name: string; input: Record<string, unknown> } | null;
  totalUsage: TokenUsage;
  pendingMessage: string | null;
  sendMessage: (text: string) => void;
  clearConversation: () => void;
  cancelPending: () => string | null;
}

export function useAgent(agentLoop: AgentLoop): UseAgentReturn {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState("");
  const [loopDisplay, setLoopDisplay] = useState<LoopDisplayItem[]>([]);
  const [activeToolCall, setActiveToolCall] = useState<{ id: string; name: string; input: Record<string, unknown> } | null>(null);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0 });
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Refs for building the final CompletedTurn
  const currentUserMessageRef = useRef<string>("");
  const accumulatedBlocksRef = useRef<ContentBlock[]>([]);
  const toolResultsMapRef = useRef<Map<string, string>>(new Map());
  const isRunningRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (event: AgentEvent) => {
      switch (event.type) {
        case "status_change":
          setStatus(event.status);
          if (event.status === "streaming") {
            setStreamingText("");
          }
          break;

        case "text_delta":
          setStreamingText((prev) => prev + event.text);
          break;

        case "text_complete":
          accumulatedBlocksRef.current.push({ type: "text", text: event.text });
          setLoopDisplay((prev) => [...prev, { kind: "text", text: event.text }]);
          setStreamingText("");
          break;

        case "tool_executing":
          accumulatedBlocksRef.current.push({
            type: "tool_use",
            id: event.id,
            name: event.name,
            input: event.input,
          });
          setActiveToolCall({ id: event.id, name: event.name, input: event.input });
          break;

        case "tool_result":
          toolResultsMapRef.current.set(event.id, event.result);
          setActiveToolCall((prev) => {
            if (prev && prev.id === event.id) {
              setLoopDisplay((d) => [...d, {
                kind: "tool",
                id: event.id,
                name: prev.name,
                input: prev.input,
                result: event.result,
              }]);
              return null;
            }
            return prev;
          });
          break;

        case "usage_update":
          setTotalUsage((prev) => ({
            inputTokens: prev.inputTokens + event.usage.inputTokens,
            outputTokens: prev.outputTokens + event.usage.outputTokens,
          }));
          break;

        case "loop_complete": {
          if (currentUserMessageRef.current) {
            const turn: CompletedTurn = {
              userMessage: currentUserMessageRef.current,
              assistantBlocks: [...accumulatedBlocksRef.current],
              toolResults: new Map(toolResultsMapRef.current),
            };
            setCompletedTurns((prev) => [...prev, turn]);
          }
          currentUserMessageRef.current = "";
          accumulatedBlocksRef.current = [];
          toolResultsMapRef.current.clear();
          setCurrentUserMessage("");
          setLoopDisplay([]);
          setActiveToolCall(null);
          setStreamingText("");
          isRunningRef.current = false;

          // Process pending message if one exists
          const next = pendingRef.current;
          if (next) {
            pendingRef.current = null;
            setPendingMessage(null);
            // Defer to next tick so state updates settle
            setTimeout(() => {
              isRunningRef.current = true;
              currentUserMessageRef.current = next;
              accumulatedBlocksRef.current = [];
              toolResultsMapRef.current.clear();
              setCurrentUserMessage(next);
              setLoopDisplay([]);
              setActiveToolCall(null);
              agentLoop.sendMessage(next);
            }, 0);
          }
          break;
        }

        case "error": {
          if (currentUserMessageRef.current) {
            accumulatedBlocksRef.current.push({
              type: "text",
              text: `[Error: ${event.error}]`,
            });
            const turn: CompletedTurn = {
              userMessage: currentUserMessageRef.current,
              assistantBlocks: [...accumulatedBlocksRef.current],
              toolResults: new Map(toolResultsMapRef.current),
            };
            setCompletedTurns((prev) => [...prev, turn]);
          }
          currentUserMessageRef.current = "";
          accumulatedBlocksRef.current = [];
          toolResultsMapRef.current.clear();
          setCurrentUserMessage("");
          setLoopDisplay([]);
          setActiveToolCall(null);
          setStreamingText("");
          isRunningRef.current = false;
          pendingRef.current = null;
          setPendingMessage(null);
          break;
        }
      }
    };

    agentLoop.on("event", handler);
    return () => {
      agentLoop.off("event", handler);
    };
  }, [agentLoop]);

  const sendMessage = useCallback(
    (text: string) => {
      if (isRunningRef.current) {
        // Agent is busy — hold one pending message (latest wins)
        pendingRef.current = text;
        setPendingMessage(text);
      } else {
        isRunningRef.current = true;
        currentUserMessageRef.current = text;
        accumulatedBlocksRef.current = [];
        toolResultsMapRef.current.clear();
        setCurrentUserMessage(text);
        setLoopDisplay([]);
        setActiveToolCall(null);
        agentLoop.sendMessage(text);
      }
    },
    [agentLoop],
  );

  const cancelPending = useCallback((): string | null => {
    const text = pendingRef.current;
    pendingRef.current = null;
    setPendingMessage(null);
    return text;
  }, []);

  const clearConversation = useCallback(() => {
    agentLoop.clearMessages();
    setCompletedTurns([]);
    setStreamingText("");
    setCurrentUserMessage("");
    setLoopDisplay([]);
    setActiveToolCall(null);
    pendingRef.current = null;
    setPendingMessage(null);
  }, [agentLoop]);

  return {
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
  };
}
