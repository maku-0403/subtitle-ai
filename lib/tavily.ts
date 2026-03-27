export interface TavilyConfig {
  apiKey: string;
  baseUrl: string;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilySearchResult[];
}

export function getTavilyConfig(): TavilyConfig | null {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: process.env.TAVILY_BASE_URL ?? "https://api.tavily.com"
  };
}

export async function tavilySearch(
  query: string,
  config: TavilyConfig
): Promise<TavilySearchResponse> {
  const response = await fetch(`${config.baseUrl}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      query,
      topic: "general",
      search_depth: "basic",
      max_results: 3,
      include_answer: "basic",
      include_raw_content: false,
      include_images: false,
      auto_parameters: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily search error ${response.status}: ${errorText || "unknown"}`);
  }

  const payload = await response.json();
  const rawResults: unknown[] = Array.isArray(payload?.results) ? payload.results : [];
  const results = rawResults
    .map((item: unknown): TavilySearchResult | null => {
      if (!item || typeof item !== "object") return null;
      const result = item as Record<string, unknown>;
      return {
        title:
          typeof result.title === "string" ? result.title.trim().slice(0, 120) : "",
        url: typeof result.url === "string" ? result.url.trim() : "",
        content:
          typeof result.content === "string"
            ? result.content.trim().slice(0, 400)
            : "",
        score:
          typeof result.score === "number" && !Number.isNaN(result.score)
            ? result.score
            : 0,
        published_date:
          typeof result.published_date === "string"
            ? result.published_date.trim().slice(0, 40)
            : undefined
      };
    })
    .filter(
      (item: TavilySearchResult | null): item is TavilySearchResult =>
        Boolean(item && item.url && item.title)
    );

  return {
    answer: typeof payload?.answer === "string" ? payload.answer.trim() : undefined,
    results
  };
}
