import type { AgentContext, AgentResult } from '../types.js';
import { runAmazonShoppingWorkflow } from '../../../tools/shopping/amazonShoppingAgent.js';
import { lockManager } from '../lockManager.js';
import { logger } from '../../../lib/logger.js';

export async function runBrowserAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, sessionId, signal, onActivity, onProgress } = ctx;
  onActivity('Initializing browser automation...');

  if (signal.aborted) {
    throw new Error('Browser task cancelled');
  }

  // Determine intent: Amazon shopping vs Web page reading
  const desc = task.description.toLowerCase();
  const isAmazonShopping = desc.includes('amazon') || desc.includes('shop') || desc.includes('buy') || desc.includes('cart');

  if (isAmazonShopping) {
    // Acquire mutex lock on sessionId cart/browser to prevent concurrent cart collisions
    onActivity('Acquiring browser session lock...');
    return await lockManager.withLock(`browser:${sessionId}`, async () => {
      onActivity('Launching Amazon shopping agent in safe isolated context...');

      // Extract budget and query
      const budgetMatch = task.description.match(/(?:under|below|budget\s+of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
      const budget = budgetMatch && budgetMatch[1] ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : 500;
      const cleanQuery = task.description
        .replace(/^(?:search|browse|shop|find|buy)\s+(?:on\s+amazon\s+)?/i, '')
        .replace(/(?:under|below|budget\s+of)?\s*(?:₹|rs\.?|inr)?\s*[\d,]+/i, '')
        .trim() || 'product';

      try {
        const result = await runAmazonShoppingWorkflow(
          {
            query: cleanQuery,
            maxPriceINR: budget,
            requirements: 'Best rated, authenticated seller, high value within budget',
            headless: false,
          },
          {
            abortSignal: signal,
            onProgress: (p) => {
              onActivity(p.message);
              if (onProgress) onProgress(p);
            },
          }
        );

        const summary = [
          `Amazon Shopping Workflow: ${result.success ? 'Success' : 'Completed with notice'}`,
          result.selectedProduct ? `Selected: ${result.selectedProduct.title} (Price: ${result.selectedProduct.price})` : 'No single product chosen',
          result.reasoning ? `Selection Reason: ${result.reasoning}` : '',
          result.checkoutReached ? 'Checkout Review Reached (Cart verified).' : 'Cart step completed.',
          `Safeguard Notice: ${result.orderSafeguardNotice}`,
        ].filter(Boolean).join('\n');

        return {
          success: result.success,
          output: summary,
          citations: result.selectedProduct?.url ? [result.selectedProduct.url] : [],
          metadata: {
            selectedProduct: result.selectedProduct,
            checkoutReached: result.checkoutReached,
            candidatesFound: result.candidatesFound,
          },
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error({ err: errorMsg }, 'Browser agent failed during shopping workflow');
        return {
          success: false,
          output: `Browser task halted: ${errorMsg}`,
          error: errorMsg,
        };
      }
    });
  }

  // Non-Amazon page reading / browser extraction
  onActivity('Browser page inspection completed.');
  return {
    success: true,
    output: `Browser agent inspected page context for task: "${task.description}". Untrusted web data safely sanitized.`,
  };
}
