import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';
import { searchWeb } from '../../../tools/search/searchWeb.js';
import { searchProducts } from '../../../tools/shopping/searchProducts.js';
import { logger } from '../../../lib/logger.js';

export async function runResearchAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Analyzing research requirements and scope...');

  if (signal.aborted) {
    throw new Error('Research task cancelled');
  }

  // 1. Determine search query from task description
  const cleanDescription = task.description.replace(/^research\s+/i, '').trim();
  const citations: string[] = [];
  let gatheredData = '';
  let providerUsed = 'Direct Knowledge';

  const isShoppingQuery =
    /\b(buy|shop|cart|amazon|purchase|price of|sneakers|shoes|headphone|laptop|phone|gadget)\b/i.test(cleanDescription) &&
    !/\b(trip|hotel|hostel|stay|accommodation|train|bus|flight|sightseeing|monument|itinerary|jaipur)\b/i.test(cleanDescription);

  // 2. Execute retrieval using live external search
  try {
    if (isShoppingQuery) {
      onActivity(`Searching real product listings for "${cleanDescription}"...`);
      const budgetMatch = cleanDescription.match(/(?:under|below|budget\s+of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
      const maxPrice = budgetMatch && budgetMatch[1] ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : undefined;

      if (process.env.SERPAPI_KEY) {
        try {
          const prodResults = await searchProducts({
            query: cleanDescription,
            maxPriceINR: maxPrice,
            limit: 5,
          });

          if (prodResults.products && prodResults.products.length > 0) {
            providerUsed = prodResults.provider;
            gatheredData += `Product Findings (${prodResults.provider}):\n` +
              prodResults.products
                .map((p, i) => {
                  citations.push(p.url);
                  return `${i + 1}. ${p.title} - ${p.price || ('₹' + p.priceINR)} (${p.seller || 'Online'}) [Source: ${p.url}]`;
                })
                .join('\n');
          }
        } catch (err) {
          logger.warn({ err }, 'Product search error; falling back to web search');
        }
      }
    }

    // If not a shopping query or shopping returned nothing, run Google Web Search
    if (!gatheredData) {
      onActivity(`Querying live search sources for "${cleanDescription}"...`);
      const webResults = await searchWeb({
        query: cleanDescription,
        limit: 5,
      });

      if (webResults.results.length > 0) {
        providerUsed = webResults.provider;
        gatheredData += `Live Search Evidence (${webResults.provider}):\n` +
          webResults.results
            .map((r, i) => {
              citations.push(r.url);
              return `${i + 1}. ${r.title}\n   Snippet: ${r.snippet}\n   URL: ${r.url}${r.price ? `\n   Listed Price: ${r.price}` : ''}`;
            })
            .join('\n\n');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Search retrieval fallback activated');
  }

  // If dependency results provided extra context
  if (dependencyResults.size > 0) {
    gatheredData += '\n\nPrior Context from Dependency Tasks:\n';
    for (const [depId, depRes] of dependencyResults.entries()) {
      gatheredData += `[Task ${depId}]: ${depRes}\n`;
    }
  }

  if (signal.aborted) {
    throw new Error('Research task cancelled');
  }

  onActivity('Synthesizing verified findings and evaluating uncertainties...');

  // 3. Ask LLM to extract verified findings with source URLs
  const systemPrompt = `You are Karma's Specialist Research Agent.
Role:
- Review the retrieved search evidence carefully.
- Return concise, objective, highly factual findings with explicit source URLs or citations.
- Clearly distinguish between VERIFIED FACTS and UNCERTAINTIES/ESTIMATES.
- If data is incomplete or unavailable, explicitly identify what could not be verified.
- Do not invent claims, prices, room rates, fares, or availability.
- Always include realistic estimated cost ranges for items where exact real-time booking costs fluctuate (e.g. dynamic hostel rates, auto-rickshaw fares).`;

  const userPrompt = `Research Request: "${task.description}"

Retrieved Source Evidence:
${gatheredData || 'No live search results returned; provide verified factual baseline details with clearly highlighted uncertainty and estimates.'}

Please return your structured findings formatted as:
### Key Findings
[Concise factual bullet points with specific names, rates/costs, and citations]

### Verified Facts & Pricing
[Exact verified details, rates in INR, timing, locations with sources]

### Uncertainties or Discrepancies
[Unknowns, seasonal fare variations, dynamic surge prices, or unverified claims]

### Sources & Retrieval Information
[List of source URLs referenced, retrieval timestamp: ${new Date().toISOString()}]`;

  const response = await callAgentLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    undefined,
    {
      signal,
      temperature: 0.1,
    }
  );

  return {
    success: true,
    output: response.text,
    citations,
    metadata: {
      sourcesCount: citations.length,
      retrievedAt: new Date().toISOString(),
      provider: providerUsed,
      taskDescription: task.description,
    },
  };
}
