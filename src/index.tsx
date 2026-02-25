#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { loadConfig, PROVIDER_DEFAULTS } from "./config/index.js";
import { createProvider } from "./providers/index.js";
import { createToolRegistry } from "./tools/index.js";
import { AgentLoop } from "./agent/loop.js";
import { PassthroughSafety } from "./safety/passthrough.js";
import { JsonFileStorage } from "./session/json-storage.js";
import { SessionManager } from "./session/manager.js";
import { App } from "./ui/App.js";

async function main() {
  const config = loadConfig(process.argv.slice(2));

  // Create provider
  const providerConfig = {
    name: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? PROVIDER_DEFAULTS[config.provider]?.baseUrl,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  };

  let currentProvider = createProvider(providerConfig);

  // Provider factory for LLM tools — always returns current provider config
  const providerFactory = () => {
    return createProvider({
      ...providerConfig,
      name: currentProvider.name,
      model: currentProvider.model,
    });
  };

  // Create tool registry
  const tools = createToolRegistry(providerFactory);

  // Create safety
  const safety = new PassthroughSafety();

  // Create agent loop
  const agentLoop = new AgentLoop(currentProvider, tools, safety);

  // Track provider changes so factory stays current
  const originalSetProvider = agentLoop.setProvider.bind(agentLoop);
  agentLoop.setProvider = (provider) => {
    currentProvider = provider;
    originalSetProvider(provider);
  };

  // Create session manager
  const storage = new JsonFileStorage(config.sessionDir);
  const sessionManager = new SessionManager(
    storage,
    config.provider,
    config.model,
    config.sessionId,
  );
  await sessionManager.initialize();

  // Load existing session if specified
  if (config.sessionId) {
    try {
      const session = await sessionManager.load(config.sessionId);
      agentLoop.setMessages(session.messages);
    } catch {
      // Session doesn't exist yet, that's fine
    }
  }

  // Auto-save on agent loop completion
  agentLoop.on("event", (event) => {
    if (event.type === "loop_complete") {
      const provider = agentLoop.getProvider();
      sessionManager.save(event.messages, provider.name, provider.model).catch(() => {});
    }
  });

  // Render the Ink app
  render(<App agentLoop={agentLoop} sessionManager={sessionManager} config={config} />);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
