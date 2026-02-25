# Kaldi Code

A modular, production-grade CLI coding agent built with TypeScript, React/Ink, and Bun.

Multi-provider streaming (Anthropic, OpenAI, Ollama), 10 built-in tools, sub-agent delegation, session persistence, and a terminal UI.

```
 ██╗  ██╗ █████╗ ██╗     ██████╗ ██╗
 ██║ ██╔╝██╔══██╗██║     ██╔══██╗██║
 █████╔╝ ███████║██║     ██║  ██║██║
 ██╔═██╗ ██╔══██║██║     ██║  ██║██║
 ██║  ██╗██║  ██║███████╗██████╔╝██║
 ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝
```

## Quick Start

```bash
# Install dependencies
bun install

# Run with Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...
bun src/index.tsx

# Run with OpenAI
export OPENAI_API_KEY=sk-...
bun src/index.tsx --provider openai --model gpt-4o

# Run with Ollama (local)
ollama serve                # start server (if not running)
ollama pull llama3.2:3b     # pull model (if not downloaded)
bun src/index.tsx --provider ollama --model llama3.2:3b
```

## Build

```bash
# Compile to standalone binary
bun build src/index.tsx --compile --outfile kaldi-code

# Run the binary
./kaldi-code
./kaldi-code --provider ollama --model llama3.2:3b
```

## CLI Options

| Flag | Description | Default |
|---|---|---|
| `--provider` | Provider name: `anthropic`, `openai`, `ollama` | `anthropic` |
| `--model` | Model identifier | Provider default |
| `--base-url` | Custom API base URL | Provider default |
| `--max-tokens` | Max output tokens | `8192` (Anthropic), `4096` (others) |
| `--temperature` | Sampling temperature | Provider default |
| `--session` | Session ID to resume | New session |
| `--session-dir` | Session storage directory | `~/.kaldi-code/sessions/` |

Environment variables `KALDI_PROVIDER` and `KALDI_MODEL` can also be used.

## Slash Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/q`, `/quit` | Exit |
| `/c`, `/clear` | Clear conversation history |
| `/save` | Save current session |
| `/load <id>` | Load a saved session |
| `/sessions` | List saved sessions |
| `/provider <name> [model]` | Switch provider at runtime |

## Tools

The agent has access to 10 tools:

| Tool | Type | Description |
|---|---|---|
| `read` | File | Read file contents with line numbers |
| `write` | File | Write content to a file |
| `edit` | File | Find-and-replace in a file |
| `glob` | File | Find files by glob pattern |
| `grep` | File | Search file contents by regex |
| `bash` | System | Execute shell commands |
| `web_search` | Web | DuckDuckGo search (top 5 results) |
| `web_fetch` | Web/LLM | Fetch URL, convert to markdown, LLM-summarize |
| `plan` | Planning | Markdown checklist for task planning |
| `delegate` | Agent/LLM | Spawn a sub-agent for isolated tasks |

## Providers

### Anthropic (default)

Requires `ANTHROPIC_API_KEY`. Default model: `claude-sonnet-4-5`.

### OpenAI

Requires `OPENAI_API_KEY`. Default model: `gpt-4o`.

### Ollama (local)

No API key needed. Requires [Ollama](https://ollama.com) running locally. Default model: `llama3`.

Recommended small models for M1 Macs:
- `llama3.2:3b` — 2GB, fast
- `llama3:latest` — 4.7GB, better quality

## Sessions

Sessions auto-save to `~/.kaldi-code/sessions/` as JSON after each agent turn. Use `/sessions` to list and `/load <id>` to restore.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design, base class hierarchy, and module breakdown.

## Project Structure

```
src/
├── types/          # Type definitions (provider, messages, tools, agent, config, session, safety)
├── providers/      # BaseProvider → Anthropic, OpenAI, Ollama
├── tools/          # BaseTool/LLMTool → 10 tool implementations + ToolRegistry
├── agent/          # BaseAgent → AgentLoop (primary) + SubAgentRunner (delegation)
├── safety/         # BaseSafety → PassthroughSafety
├── config/         # Provider defaults + CLI/env loader
├── prompts/        # System prompt builder
├── session/        # BaseStorage → JsonFileStorage + SessionManager
└── ui/             # React/Ink components + hooks (useAgent, useSession, useCommands)
```

## License

MIT
