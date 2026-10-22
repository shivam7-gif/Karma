import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';
import { searchProducts } from '../../../tools/shopping/searchProducts.js';
import { logger } from '../../../lib/logger.js';

export async function runResearchAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Analyzing research requirements and queries...');

  if (signal.aborted) {
    throw new Error('Research task cancelled');
  }

  // 1. Determine search query from task description
  const query = task.description.replace(/^research\s+/i, '').trim();
  const citations: string[] = [];
  let gatheredData = '';

  // 2. Execute retrieval
  try {
    onActivity(`Searching real sources for "${query}"...`);
    const budgetMatch = query.match(/(?:under|below|budget\s+of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
    const maxPrice = budgetMatch && budgetMatch[1] ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : undefined;

    if (process.env.SERPAPI_KEY) {
      try {
        const prodResults = await searchProducts({
          query,
          maxPriceINR: maxPrice,
          limit: 5,
        });

        if (prodResults.products && prodResults.products.length > 0) {
          gatheredData += `Shopping & Product Findings:\n` + prodResults.products
            .map((p, i) => {
              citations.push(p.url);
              return `${i + 1}. ${p.title} - ${p.price || ('₹' + p.priceINR)} (${p.seller || 'Online'}) [Source: ${p.url}]`;
            })
            .join('\n');
        }
      } catch (err) {
        logger.warn({ err }, 'Product search encountered an error, proceeding with web search fallback');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Search retrieval fallback');
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
- Use available search and retrieval data.
- Return concise, objective findings with explicit source URLs or citations.
- Clearly distinguish between VERIFIED FACTS and UNCERTAINTIES/ESTIMATES.
- If data is incomplete, explicitly identify what could not be verified.
- Do not invent claims, prices, or specifications.`;

  const userPrompt = `Research Request: "${task.description}"

Retrieved Source Evidence:
${gatheredData || 'No external API search results returned; rely on verified general knowledge and clearly highlight uncertainty.'}

Please return your structured findings formatted as:
### Key Findings
[Concise factual bullet points with citations]

### Verified Facts
[Verified specs/prices with sources]

### Uncertainties or Discrepancies
[Unknowns, estimates, or unverified claims]

### Sources
[List of source URLs referenced]`;

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
    },
  };
}
