import { useCallback } from "react";
import type { ProviderConfig } from "../../types/index.js";
import { createProvider } from "../../providers/index.js";
import { PROVIDER_DEFAULTS } from "../../config/defaults.js";
import type { AgentLoop } from "../../agent/loop.js";
import type { SessionManager } from "../../session/manager.js";

interface CommandHandlers {
  clearConversation: () => void;
  onExit: () => void;
  agentLoop: AgentLoop;
  sessionManager: SessionManager;
  setOutput: (text: string) => void;
}

interface UseCommandsReturn {
  handleInput: (text: string) => boolean; // returns true if it was a command
}

export function useCommands(handlers: CommandHandlers): UseCommandsReturn {
  const handleInput = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();

      if (trimmed === "/q" || trimmed === "/quit" || trimmed === "exit") {
        handlers.onExit();
        return true;
      }

      if (trimmed === "/c" || trimmed === "/clear") {
        handlers.clearConversation();
        handlers.setOutput("Kaldi dropped the ball. Fresh start!");
        return true;
      }

      if (trimmed === "/save") {
        const provider = handlers.agentLoop.getProvider();
        handlers.sessionManager
          .save(handlers.agentLoop.getMessages(), provider.name, provider.model)
          .then(() => handlers.setOutput(`Kaldi buried this session! ID: ${handlers.sessionManager.getSessionId()}`))
          .catch((err: unknown) => handlers.setOutput(`Kaldi couldn't bury that: ${err}`));
        return true;
      }

      if (trimmed === "/sessions" || trimmed === "/list") {
        handlers.sessionManager
          .list()
          .then((sessions) => {
            if (sessions.length === 0) {
              handlers.setOutput("No buried sessions. Kaldi's yard is clean!");
            } else {
              const lines = sessions.map(
                (s) =>
                  `  🦴 ${s.id}  ${s.updatedAt.slice(0, 16)}  ${s.provider}/${s.model}  ${s.messageCount} msgs  "${s.preview}"`,
              );
              handlers.setOutput("Kaldi's buried sessions:\n" + lines.join("\n"));
            }
          })
          .catch((err: unknown) => handlers.setOutput(`Kaldi tripped: ${err}`));
        return true;
      }

      if (trimmed.startsWith("/load ")) {
        const id = trimmed.slice(6).trim();
        handlers.sessionManager
          .load(id)
          .then((session) => {
            handlers.agentLoop.setMessages(session.messages);
            handlers.setOutput(`Kaldi dug up session ${id}! (${session.messages.length} messages)`);
          })
          .catch((err: unknown) => handlers.setOutput(`Kaldi couldn't find that bone: ${err}`));
        return true;
      }

      if (trimmed.startsWith("/provider")) {
        const parts = trimmed.split(/\s+/);
        const providerName = parts[1];
        const model = parts[2];

        if (!providerName) {
          const current = handlers.agentLoop.getProvider();
          handlers.setOutput(`Kaldi's brain: ${current.name}/${current.model}\nUsage: /provider <name> [model]`);
          return true;
        }

        const defaults = PROVIDER_DEFAULTS[providerName];
        if (!defaults) {
          handlers.setOutput(`Kaldi doesn't know "${providerName}". Try: anthropic, openai, ollama`);
          return true;
        }

        const config: ProviderConfig = {
          ...defaults,
          model: model ?? defaults.model,
          apiKey: getApiKey(providerName),
        };

        try {
          const provider = createProvider(config);
          handlers.agentLoop.setProvider(provider);
          handlers.setOutput(`Kaldi switched brains to ${provider.name}/${provider.model}!`);
        } catch (err: unknown) {
          handlers.setOutput(`Kaldi got confused: ${err}`);
        }
        return true;
      }

      if (trimmed === "/help") {
        handlers.setOutput(
          "Kaldi knows these tricks:\n" +
            "  /q, /quit     Kaldi goes to sleep\n" +
            "  /c, /clear    Drop the ball, start fresh\n" +
            "  /save         Bury current session\n" +
            "  /load <id>    Dig up a session\n" +
            "  /sessions     Show buried sessions\n" +
            "  /provider     Show or switch Kaldi's brain\n" +
            "  /help         Show these tricks",
        );
        return true;
      }

      return false;
    },
    [handlers],
  );

  return { handleInput };
}

function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    default:
      return undefined;
  }
}
