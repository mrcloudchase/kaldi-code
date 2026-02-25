# Architecture

Kaldi Code is built around abstract base classes that define contracts for each subsystem. Concrete implementations extend these bases, enabling extensibility without modifying consumers.

## System Overview

```
CLI Entry (src/index.tsx)
  → loadConfig() → createProvider() → createToolRegistry()
  → new AgentLoop(provider, tools, safety)
  → new SessionManager(storage)
  → render(<App />)
```

```
React/Ink UI Layer:
  <App>
    useAgent(agentLoop)     → status, streamingText, completedTurns, usage
    useSession(manager)     → save/load/list
    useCommands(handlers)   → slash command routing
    │
    ├── <Header />           ASCII banner + provider/model/cwd
    ├── <Static>             Completed turns (never re-rendered)
    │     └── <MessageBlock />
    ├── <StreamingText />    Live token-by-token text
    ├── <ToolCall />         Active tool with spinner
    ├── <Spinner />          Thinking indicator
    ├── <InputPrompt />      User input (disabled during agent run)
    └── <StatusBar />        Provider, model, tokens, session ID
```

## Base Class Hierarchy

### BaseProvider (`src/providers/base.ts`)

Defines the provider contract. All providers normalize their streaming output into a common `StreamEvent` type.

```
BaseProvider (abstract)
├── AnthropicProvider   POST /v1/messages (SSE)
├── OpenAIProvider      POST /v1/chat/completions (SSE)
└── OllamaProvider      POST /api/chat (NDJSON)
```

**Key methods:**
- `stream(messages, systemPrompt, tools, signal)` → `AsyncGenerator<StreamEvent>`
- `formatTools(tools)` → provider-specific tool format
- `formatMessages(messages, systemPrompt)` → provider-specific message format
- `parseSSE(reader)` → shared SSE line parser (used by Anthropic + OpenAI)

**StreamEvent types:**
```typescript
| { type: "text_delta"; text: string }
| { type: "tool_use_start"; id: string; name: string }
| { type: "tool_input_delta"; id: string; partialJson: string }
| { type: "tool_use_end"; id: string; input: Record<string, unknown> }
| { type: "message_start"; messageId: string }
| { type: "message_end"; stopReason: string; usage: TokenUsage }
```

All three providers produce these same events. The agent loop and UI never know which provider is active.

### BaseTool (`src/tools/base.ts`)

Defines the tool contract. Each tool declares its name, description, parameters, and safety level.

```
BaseTool (abstract)
├── ReadTool
├── WriteTool
├── EditTool
├── GlobTool
├── GrepTool
├── BashTool
├── WebSearchTool
├── PlanTool
│
└── LLMTool (abstract) — tools that make inner LLM calls
    ├── WebFetchTool
    └── DelegateTool
```

**Key methods:**
- `execute(input)` — public entry point. Validates input, calls `run()`, catches errors.
- `run(input)` — abstract. Subclasses implement the actual logic.
- `toSchema()` — generates the tool schema for provider APIs.

The `execute()` wrapper in `BaseTool` handles:
1. Required parameter validation
2. Error catching and formatting
3. Consistent return type (`Promise<string>`)

Subclasses only implement `run()` — the pure tool logic.

### LLMTool (`src/tools/llm-tool.ts`)

Extends `BaseTool` with the ability to make inner LLM calls. Receives a provider factory function.

**Key method:**
- `llmCall(prompt, systemPrompt?)` — one-shot, non-streaming, text-only LLM call.

Used by:
- **WebFetchTool**: fetches a URL, converts HTML → Markdown, uses inner LLM to summarize/extract.
- **DelegateTool**: spawns a `SubAgentRunner` with its own context window.

### BaseAgent (`src/agent/base.ts`)

Defines the agent contract. Extends `EventEmitter` to bridge with the React UI.

```
BaseAgent (abstract, extends EventEmitter)
├── AgentLoop        Primary agent — emits events to UI, runs agentic while-loop
└── SubAgentRunner   Lightweight — runs silently, returns final text result
```

**Key methods:**
- `sendMessage(text)` — abstract. Starts the agentic loop.
- `abort()` — abstract. Cancels the current operation.
- `setProvider(provider)` — swap provider at runtime.
- `getMessages() / setMessages() / clearMessages()` — message history management.
- `emitEvent(event)` — emit typed `AgentEvent` for the UI.

### BaseSafety (`src/safety/base.ts`)

Defines the confirmation contract for tool execution.

```
BaseSafety (abstract)
└── PassthroughSafety   Allows everything (no confirmation prompts)
```

**Key methods:**
- `shouldConfirm(tool, input)` — should this tool call require user confirmation?
- `requestConfirmation(tool, input)` — prompt user and return decision.

Designed for future implementations like `InteractiveSafety` (prompt in UI) or `RuleSafety` (pattern-based allow/deny rules).

### BaseStorage (`src/session/base.ts`)

Defines the session persistence contract.

```
BaseStorage (abstract)
└── JsonFileStorage   JSON files in ~/.kaldi-code/sessions/
```

**Key methods:**
- `save(session)` / `load(id)` / `list()` / `delete(id)` / `initialize()`

`SessionManager` wraps `BaseStorage` with current session tracking and auto-save.

## Agent Loop Flow

```
sendMessage(text)
  → push user message
  → while (true):
      streamTurn()
        → provider.stream(messages, systemPrompt, toolSchemas, signal)
        → emit text_delta events as tokens arrive
        → accumulate ContentBlocks (text + tool_use)
      push assistant message
      collect tool_use blocks
      if none → break (done)
      for each tool_use:
        → safety check → tool.execute(input) → emit tool_result
      push tool results as user message
      continue loop
  → emit loop_complete
```

Each iteration of the while-loop is one "turn". A turn may produce text, tool calls, or both. The loop continues until the model responds with text only (no tool calls).

## Sub-Agent / Delegation Flow

```
Primary AgentLoop
  → LLM calls delegate tool with { task: "...", tools: "..." }
  → DelegateTool creates SubAgentRunner
      - Fresh message history (own context window)
      - All tools except delegate (no recursion)
      - maxTurns limit (default: 10)
  → SubAgentRunner.run(task)
      - Runs its own agentic while-loop silently
      - No events emitted to UI
      - Returns final text response
  → Result flows back as tool_result to primary AgentLoop
```

Sub-agents keep the primary context window clean. Intermediate exploration steps (file reads, searches, etc.) stay in the sub-agent's context and don't pollute the main conversation.

## Provider Runtime Switching

Users can switch providers mid-session via `/provider <name> [model]`:

1. `useCommands` parses the slash command
2. `createProvider()` factory builds a new provider instance
3. `agentLoop.setProvider(newProvider)` swaps it in
4. Provider factory for LLM tools is updated to match
5. StatusBar reflects the new provider/model
6. Next message uses the new provider

Switching only works when the agent is idle (between turns).

## Message Format

Messages use a provider-agnostic format:

```typescript
interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;
```

Each provider's `formatMessages()` converts this to the provider-specific wire format:
- **Anthropic**: native ContentBlock arrays
- **OpenAI**: `tool_calls` array on assistant messages, separate `tool` role messages
- **Ollama**: same as OpenAI format

## UI Architecture

The UI uses React/Ink with three custom hooks:

- **useAgent**: bridges `AgentLoop` EventEmitter → React state. Tracks status, streaming text, completed turns, active tool calls, and token usage.
- **useSession**: wraps `SessionManager` for save/load/list operations.
- **useCommands**: parses slash commands and routes to handlers.

Completed turns use Ink's `<Static>` component, which renders items once and never re-renders them. This prevents performance degradation as the conversation grows.

## Module Dependency Graph

```
types/          ← (no deps, everything imports from here)
config/         ← types
prompts/        ← (standalone)
providers/      ← types
safety/         ← types, tools/base
tools/          ← types, providers/base, agent/sub-agent (dynamic import)
agent/          ← types, providers/base, tools/registry, safety/base, prompts
session/        ← types
ui/             ← types, agent, session, providers, config
index.tsx       ← (wires everything together)
```

The `DelegateTool` uses a dynamic `import()` for `SubAgentRunner` to avoid circular dependencies between the tools and agent modules.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Abstract base classes | Every subsystem has one | Extensible without modifying consumers; shared logic lives once |
| Raw `fetch` per provider | No SDKs | Minimal deps, full streaming control, consistent approach |
| Normalized StreamEvent | Single event type across providers | Agent loop is completely provider-agnostic |
| BaseTool.execute() wraps run() | Shared validation + error handling | Subclasses only implement core logic |
| LLMTool base class | Inner LLM calls from tools | Enables summarization, analysis without agent involvement |
| Sub-agents via DelegateTool | Fresh context, maxTurns limit | Keeps primary context clean; prevents runaway agents |
| EventEmitter → React hooks | useAgent bridges the gap | Agent testable in isolation; events drive UI state |
| Ink Static for completed turns | Never re-rendered | Performance stays constant as conversation grows |
| JSON file sessions | Simple, inspectable | Swap to SQLite later without touching SessionManager |
| PassthroughSafety stub | Allow everything for now | Safety module is isolated, ready for real implementations |

## Extending

### Add a new provider

1. Create `src/providers/my-provider.ts` extending `BaseProvider`
2. Implement `stream()`, `formatTools()`, `formatMessages()`
3. Add to `createProvider()` factory in `src/providers/index.ts`
4. Add defaults to `src/config/defaults.ts`

### Add a new tool

1. Create `src/tools/my-tool.ts` extending `BaseTool` (or `LLMTool` if it needs LLM calls)
2. Implement `run()`, declare `name`, `description`, `params`, `safety`
3. Register in `createToolRegistry()` in `src/tools/index.ts`

### Add a safety implementation

1. Create `src/safety/my-safety.ts` extending `BaseSafety`
2. Implement `shouldConfirm()` and `requestConfirmation()`
3. Swap in at `src/index.tsx` where `PassthroughSafety` is currently used

### Add a storage backend

1. Create `src/session/my-storage.ts` extending `BaseStorage`
2. Implement `save()`, `load()`, `list()`, `delete()`, `initialize()`
3. Swap in at `src/index.tsx` where `JsonFileStorage` is currently used
