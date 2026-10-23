import dotenv from 'dotenv';
import { logger } from '../../lib/logger.js';

dotenv.config();

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string | undefined;
  price?: string | undefined;
  timestamp: string;
}

export interface SearchWebInput {
  query: string;
  limit?: number | undefined;
  gl?: string | undefined; // Geographic location code, default 'in' (India)
}

export interface SearchWebOutput {
  query: string;
  count: number;
  results: WebSearchResult[];
  provider: string;
  retrievedAt: string;
  isSimulated?: boolean | undefined;
}

export async function searchWeb(input: SearchWebInput): Promise<SearchWebOutput> {
  const query = input.query.trim();
  const limit = input.limit ?? 5;
  const gl = input.gl ?? 'in';
  const apiKey = process.env.SERPAPI_KEY?.trim();

  const retrievedAt = new Date().toISOString();

  if (!apiKey) {
    logger.warn('SERPAPI_KEY not configured; providing verified baseline knowledge');
    return {
      query,
      count: 0,
      results: [],
      provider: 'Verified Baseline (No API Key)',
      retrievedAt,
      isSimulated: true,
    };
  }

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('gl', gl);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('api_key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`SerpAPI returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;

    if (data.error) {
      throw new Error(data.error);
    }

    const organic = Array.isArray(data.organic_results) ? data.organic_results : [];

    const results: WebSearchResult[] = organic
      .slice(0, limit)
      .map((item: any) => {
        const resObj: WebSearchResult = {
          title: item.title || 'Untitled Result',
          url: item.link || '',
          snippet: item.snippet || item.snippet_highlighted_words?.join(' ') || '',
          timestamp: retrievedAt,
        };
        const src = item.displayed_link || item.source || (item.link ? new URL(item.link).hostname : undefined);
        if (src) resObj.source = src;
        const price = item.rich_snippet?.top?.detected_extensions?.price;
        if (price) resObj.price = price;
        return resObj;
      })
      .filter((r: WebSearchResult) => r.url.length > 0);

    return {
      query,
      count: results.length,
      results,
      provider: 'Google Search via SerpAPI',
      retrievedAt,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: errorMsg, query }, 'searchWeb failed or timed out');
    return {
      query,
      count: 0,
      results: [],
      provider: 'Fallback Search Handler',
      retrievedAt,
      isSimulated: true,
    };
  }
}
