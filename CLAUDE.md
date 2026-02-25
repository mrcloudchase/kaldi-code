# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Always make sure this is up to date as you change the codebase.

## Build & Run Commands

```bash
# Install dependencies
bun install

# Run in development
bun src/index.tsx
bun src/index.tsx --provider ollama --model llama3.2:3b
bun src/index.tsx --provider openai --model gpt-4o

# Compile to standalone binary
bun build src/index.tsx --compile --outfile kaldi-code

# Type-check (no tests exist yet)
bun run typecheck    # or: tsc --noEmit
```

Environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Ollama needs no key (local at `localhost:11434`). Also supports `KALDI_PROVIDER` and `KALDI_MODEL` env vars.

## Architecture

This is a CLI coding agent (like Claude Code) built on **Bun + TypeScript + React/Ink**. A dog named Kaldi is the mascot.

### Core Pattern: Abstract Base Classes

Every subsystem uses the same pattern: an abstract base class defines the contract, concrete classes extend it. When adding a new provider/tool/storage backend, you only create a new subclass and register it in the factory.

### The Agentic While-Loop (`src/agent/loop.ts`)

This is the heart of the system. `AgentLoop.sendMessage()` runs a while-loop that:
1. Calls the LLM via `provider.stream()` to get `ContentBlock[]` (text + tool calls)
2. Pushes the assistant message
3. If no tool calls → breaks (done)
4. Executes each tool via `tool.execute()`, collects results
5. Pushes tool results as a user message, continues loop

The loop continues until the model responds with text only. Each iteration is one "turn."

### Normalized Streaming Events

All three providers (Anthropic, OpenAI, Ollama) normalize their streaming output into a single `StreamEvent` union type. The agent loop and UI never know which provider is active. Anthropic and OpenAI use a shared `parseSSE()` method; Ollama parses NDJSON separately.

### Tool System (`src/tools/`)

- `BaseTool`: abstract class with `execute()` wrapper (validation + error handling) and abstract `run()` for subclasses.
- `LLMTool`: extends `BaseTool` with `llmCall()` for tools that need inner LLM calls (WebFetch, Delegate).
- `ToolRegistry`: map of name→tool with `buildSchemas()`, `without()`, and `filter()` for sub-agent tool subsetting.
- Tools are registered in `createToolRegistry()` in `src/tools/index.ts`.

### Sub-Agent Delegation (`src/tools/delegate.ts` → `src/agent/sub-agent.ts`)

`DelegateTool` spawns a `SubAgentRunner` with a fresh context window, all tools except `delegate` (no recursion), and a 10-turn cap. Sub-agents run silently (no UI events). The `SubAgentRunner` is imported via dynamic `import()` to avoid circular deps between tools ↔ agent.

### EventEmitter → React Bridge (`src/ui/hooks/useAgent.ts`)

`AgentLoop` extends `EventEmitter` and emits typed `AgentEvent` objects. The `useAgent` hook subscribes and maps events to React state. Uses refs to accumulate blocks during a loop, then commits a `CompletedTurn` to Ink's `<Static>` on `loop_complete`. Supports message queuing — typing while the agent is running queues one pending message.

### Session Persistence

`JsonFileStorage` saves sessions as JSON in `~/.kaldi-code/sessions/`. Auto-saves on every `loop_complete` event. `BaseStorage` is the abstract contract — swap to SQLite by implementing a new subclass.

### Safety Module

`PassthroughSafety` is a stub that allows everything. The `BaseSafety` abstract class defines `shouldConfirm()` and `requestConfirmation()` — ready for real implementations.

## Key Wiring Details

- `src/index.tsx` is the composition root — wires config, provider, tools, safety, agent, session, and UI together.
- The `providerFactory` closure in `index.tsx` ensures LLM tools always get the *current* provider, even after a `/provider` switch at runtime.
- `agentLoop.setProvider()` is monkey-patched in `index.tsx` to keep the `currentProvider` reference in sync.
- Token counting uses `@dqbd/tiktoken` (`cl100k_base`) locally, ignoring provider-reported usage.
- `src/ui/InputPrompt.tsx` exists but is unused — input is inline in `App.tsx`.

## Conventions

- No SDKs for LLM providers — all use raw `fetch()` with manual stream parsing.
- `BaseTool.execute()` always returns `Promise<string>` — errors are caught and returned as `"error: ..."` strings, never thrown.
- Tool safety is declared as `"safe"` or `"unsafe"` on each tool class. File-mutating tools (write, edit, bash) are `"unsafe"`.
- Provider message format is provider-agnostic (`Message` with `ContentBlock[]`); each provider converts in `formatMessages()`.
- The `PlanTool` holds state in memory (not persisted across sessions despite having `getState()`/`setState()`).
- Slash commands are handled in `useCommands` hook before reaching the agent — return `true` = handled, `false` = pass to agent.
