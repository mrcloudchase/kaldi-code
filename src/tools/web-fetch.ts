import type { ToolParam } from "../types/index.js";
import { LLMTool } from "./llm-tool.js";
import { NodeHtmlMarkdown } from "node-html-markdown";

export class WebFetchTool extends LLMTool {
  readonly name = "web_fetch";
  readonly description = "Fetch a URL, convert HTML to markdown, and return an LLM-summarized extract of the relevant content. Provide a prompt describing what information to extract.";
  readonly params: ToolParam[] = [
    { name: "url", type: "string", description: "URL to fetch", required: true },
    { name: "prompt", type: "string", description: "What information to extract from the page", required: true },
  ];
  readonly safety = "safe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const url = input.url as string;
    const prompt = input.prompt as string;

    const response = await fetch(url, {
      headers: { "User-Agent": "KaldiCode/1.0" },
      redirect: "follow",
    });

    if (!response.ok) {
      return `error: HTTP ${response.status} fetching ${url}`;
    }

    const html = await response.text();
    const markdown = NodeHtmlMarkdown.translate(html);

    // Truncate to avoid overwhelming the inner LLM
    const truncated = markdown.slice(0, 50000);

    const summary = await this.llmCall(
      `Given the following web page content, ${prompt}\n\n---\n\n${truncated}`,
      "You are a web content extractor. Extract and summarize the requested information concisely.",
    );

    return summary;
  }
}
