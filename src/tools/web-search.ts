import type { ToolParam } from "../types/index.js";
import { BaseTool } from "./base.js";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchTool extends BaseTool {
  readonly name = "web_search";
  readonly description = "Search the web using DuckDuckGo and return the top 5 results with title, URL, and snippet.";
  readonly params: ToolParam[] = [
    { name: "query", type: "string", description: "Search query", required: true },
  ];
  readonly safety = "safe" as const;

  protected async run(input: Record<string, unknown>): Promise<string> {
    const query = input.query as string;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "KaldiCode/1.0" },
    });
    const html = await response.text();

    const results = this.parseSearchResults(html).slice(0, 5);
    return (
      results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n") || "No results found."
    );
  }

  private parseSearchResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Match DuckDuckGo result blocks
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = resultRegex.exec(html)) !== null) {
      const [, rawUrl, rawTitle, rawSnippet] = match;
      if (!rawUrl || !rawTitle) continue;

      // DuckDuckGo wraps URLs in redirects, extract the actual URL
      let url = rawUrl;
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch?.[1]) {
        url = decodeURIComponent(uddgMatch[1]);
      }

      results.push({
        title: this.stripHtml(rawTitle),
        url,
        snippet: this.stripHtml(rawSnippet ?? ""),
      });
    }

    return results;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
  }
}
