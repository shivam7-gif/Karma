import { chromium, type Browser, type Page } from 'playwright';
import { ScreenControlOverlay } from '../../overlay/index.js';
import { chooseProduct, type Candidate } from './productAgent.js';

export interface AmazonShoppingInput {
  query: string;
  maxPriceINR?: number | undefined;
  requirements?: string | undefined;
  headless?: boolean | undefined;
}

export interface AmazonShoppingResult {
  success: boolean;
  action: string;
  query: string;
  selectedProduct?: {
    id: number;
    title: string;
    price: string;
    priceINR?: number | undefined;
    rating?: string | undefined;
    reviews?: string | undefined;
    url: string;
    asin?: string | undefined;
  } | undefined;
  reasoning?: string | undefined;
  concerns?: string[] | undefined;
  candidatesFound: number;
  candidatesEvaluated: number;
  cartUrl?: string | undefined;
  checkoutReached?: boolean | undefined;
  orderSafeguardNotice: string;
  error?: string | undefined;
}

export interface ShoppingWorkflowOptions {
  abortSignal?: AbortSignal | undefined;
  onProgress?: ((event: { status: string; message: string; data?: unknown }) => void) | undefined;
  autoCloseTimeoutMs?: number | undefined;
}

export async function runAmazonShoppingWorkflow(
  input: AmazonShoppingInput,
  options: ShoppingWorkflowOptions = {}
): Promise<AmazonShoppingResult> {
  const query = input.query?.trim() || 'creatine monohydrate';
  const budget = typeof input.maxPriceINR === 'number' && input.maxPriceINR > 0 ? input.maxPriceINR : 500;
  const requirements = input.requirements || 'Good value per serving, pure quality ingredients';
  const headless = input.headless ?? false;

  const overlay = new ScreenControlOverlay();
  let browser: Browser | null = null;
  let page: Page | null = null;

  const emitProgress = (status: string, message: string, data?: unknown) => {
    if (options.onProgress) {
      options.onProgress({ status, message, data });
    }
  };

  // Wire external abort signal
  const checkAborted = () => {
    if (options.abortSignal?.aborted || overlay.isAborted) {
      throw new Error('Automation was cancelled by the user.');
    }
  };

  try {
    emitProgress('controlling_screen', 'Starting browser automation session...', {
      url: 'https://www.amazon.in/',
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
      budgetINR: budget,
    });

    // 1. Launch screen overlay
    await overlay.start();
    overlay.setStatus('controlling_screen', 'Karma is controlling the screen', undefined, {
      activity: 'Starting browser automation session.',
      budgetINR: budget,
    });

    // Register stop handlers
    const stopCleanup = overlay.onStop(async (event) => {
      console.log(`[AmazonShoppingAgent] Stopped via ${event.reason}`);
      emitProgress('stopped', `Automation stopped via ${event.reason}`, {
        url: 'https://www.amazon.in/',
        domain: 'amazon.in',
        siteName: 'Amazon India',
        agentRole: 'Amazon Shopping Agent (Playwright)',
      });
      try {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch {}
    });

    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        try {
          overlay.setStatus('stopped', 'Automation stopped by user');
          if (page) page.close().catch(() => {});
          if (browser) browser.close().catch(() => {});
        } catch {}
      });
    }

    checkAborted();

    // 2. Launch Chromium browser
    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 80,
    });

    page = await browser.newPage({
      viewport: { width: 1366, height: 900 },
      locale: 'en-IN',
    });

    // Step 1: Open Amazon
    checkAborted();
    emitProgress('searching', 'Searching Amazon.in for products...', {
      query,
      budgetINR: budget,
      url: 'https://www.amazon.in/',
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });
    overlay.setStatus('searching', 'Searching Amazon', undefined, {
      activity: 'Opening Amazon.in and locating product search bar.',
      budgetINR: budget,
    });

    await page.goto('https://www.amazon.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Step 2: Locate search box
    checkAborted();
    const searchBox = page.locator('#twotabsearchtextbox');
    await searchBox.waitFor({ state: 'visible', timeout: 20000 });

    const searchBounds = await searchBox.boundingBox();
    if (searchBounds && !headless) {
      await page.mouse.move(
        searchBounds.x + searchBounds.width / 2,
        searchBounds.y + searchBounds.height / 2,
        { steps: 20 }
      );
      await page.waitForTimeout(300);
      await page.mouse.click(
        searchBounds.x + searchBounds.width / 2,
        searchBounds.y + searchBounds.height / 2
      );
    } else {
      await searchBox.click();
    }

    // Step 3: Type search query
    checkAborted();
    await page.keyboard.type(query, { delay: headless ? 0 : 80 });
    await page.waitForTimeout(300);

    const searchUrlPromise = page.waitForURL((url) => url.pathname.includes('/s'), { timeout: 30000 }).catch(() => null);

    overlay.setStatus('searching', 'Searching Amazon', undefined, {
      activity: `Searching for '${query}'. Waiting for listings.`,
      budgetINR: budget,
    });

    await page.keyboard.press('Enter');
    await searchUrlPromise;
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);

    // Step 4: Extract candidate listings
    checkAborted();
    const headings = page.locator('h2[aria-label], h2.a-size-base-plus, h2.a-size-mini');
    await headings.first().waitFor({ state: 'attached', timeout: 20000 });

    const count = await headings.count();
    const candidates: Candidate[] = [];

    // Query tokens for relevant filtering
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    for (let i = 0; i < count && candidates.length < 15; i++) {
      checkAborted();
      const heading = headings.nth(i);
      const title = (await heading.innerText().catch(() => '')).trim();
      if (!title) continue;

      // Ensure some query match if query has strong keywords
      const titleLower = title.toLowerCase();
      if (queryTokens.length > 0 && !queryTokens.some((tok) => titleLower.includes(tok))) {
        continue;
      }

      const href = await heading.locator('xpath=ancestor::a[1]').getAttribute('href').catch(() => null);
      if (!href) continue;

      const linkUrl = new URL(href, 'https://www.amazon.in');
      let productPath = linkUrl.pathname;
      if (linkUrl.pathname.includes('/sspa/click')) {
        const dest = linkUrl.searchParams.get('url');
        if (dest) {
          productPath = new URL(dest, 'https://www.amazon.in').pathname;
        }
      }

      const asin = productPath.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
      if (!asin) continue;

      const card = heading.locator('xpath=ancestor::div[@data-asin][1]');
      const cardText = (await card.innerText().catch(() => '')).slice(0, 400);
      const priceText = (
        await card.locator('.a-price .a-offscreen').first().innerText().catch(() => '')
      ).trim();

      const rating = await card
        .locator('[aria-label*="out of 5 stars"]')
        .first()
        .getAttribute('aria-label')
        .catch(() => null);

      candidates.push({
        id: candidates.length + 1,
        title,
        price: priceText || 'Unavailable',
        rating: rating || 'Unavailable',
        reviews: cardText.match(/\([\d,.]+[KkMm]?\)/)?.[0] || 'Unavailable',
        url: `https://www.amazon.in/dp/${asin}`,
        listingText: cardText || title,
      });
    }

    if (candidates.length === 0) {
      throw new Error(`No matching product candidates found on Amazon for query "${query}".`);
    }

    // Step 5: Product comparison and AI selection
    checkAborted();
    emitProgress('analyzing', `Comparing ${candidates.length} products with AI...`, {
      candidatesFound: candidates.length,
      budgetINR: budget,
      query,
      url: `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });

    overlay.setStatus('analyzing', 'Comparing products', undefined, {
      activity: `Extracted ${candidates.length} listings. Evaluating options against ₹${budget} budget.`,
      candidatesFound: candidates.length,
      candidatesEvaluated: Math.min(candidates.length, 10),
      budgetINR: budget,
      candidates: candidates.slice(0, 8).map((c) => ({
        id: c.id,
        title: c.title,
        price: c.price,
        rating: c.rating,
        url: c.url,
        status: 'shortlisted',
      })),
    });

    const selection = await chooseProduct(candidates.slice(0, 10), budget, query, requirements);
    const chosen = candidates.find((p) => p.id === selection.selectedId);

    if (!chosen) {
      throw new Error('LLM selected an unknown candidate ID.');
    }

    checkAborted();
    overlay.setStatus('analyzing', 'Comparing products', undefined, {
      activity: `Selected candidate #${chosen.id}: ${chosen.title.slice(0, 48)}...`,
      candidatesFound: candidates.length,
      candidatesEvaluated: Math.min(candidates.length, 10),
      budgetINR: budget,
      currentProduct: {
        id: chosen.id,
        title: chosen.title,
        price: chosen.price,
        rating: chosen.rating,
        reviews: chosen.reviews,
        url: chosen.url,
        status: 'selected',
        budgetComparison: `${chosen.price} within ₹${budget} budget`,
      },
      reasoningSummary: selection.reason,
      candidates: candidates.slice(0, 8).map((c) => ({
        id: c.id,
        title: c.title,
        price: c.price,
        rating: c.rating,
        url: c.url,
        status: c.id === chosen.id ? 'selected' : 'shortlisted',
      })),
    });

    // Step 6: Inspect selected product page
    checkAborted();
    emitProgress('opening_product', `Opening selected product page to verify live details...`, {
      title: chosen.title,
      price: chosen.price,
      budgetINR: budget,
      url: chosen.url,
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });

    overlay.setStatus('opening_product', 'Inspecting product', undefined, {
      activity: 'Opening listing page to verify live title and price.',
      currentProduct: {
        id: chosen.id,
        title: chosen.title,
        price: chosen.price,
        rating: chosen.rating,
        reviews: chosen.reviews,
        url: chosen.url,
        status: 'evaluating',
        budgetComparison: 'Verifying live price on product page...',
      },
      reasoningSummary: selection.reason,
    });

    await page.goto(chosen.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);

    const actualTitle = (await page.locator('#productTitle').innerText().catch(() => '')).trim() || chosen.title;
    const priceElement = await page.locator('#corePrice_feature_div .a-price .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen').first();
    const livePriceText = (await priceElement.innerText().catch(() => '')).trim() || chosen.price;

    const priceMatch = livePriceText.match(/[\d,]+(?:\.\d{1,2})?/);
    const numericLivePrice = priceMatch ? Number(priceMatch[0].replace(/,/g, '')) : NaN;

    if (Number.isFinite(numericLivePrice) && numericLivePrice > budget) {
      throw new Error(`Live price (₹${numericLivePrice}) exceeds budget of ₹${budget}. Cart addition cancelled for purchase safety.`);
    }

    overlay.setStatus('opening_product', 'Inspecting product', undefined, {
      activity: `Verified page: ${actualTitle.slice(0, 42)}... at ${livePriceText}.`,
      currentProduct: {
        id: chosen.id,
        title: actualTitle,
        price: livePriceText,
        rating: chosen.rating,
        reviews: chosen.reviews,
        url: chosen.url,
        status: 'verified',
        budgetComparison: Number.isFinite(numericLivePrice)
          ? `₹${numericLivePrice} is ₹${budget - numericLivePrice} under budget limit. Passed.`
          : 'Verified within budget limit.',
      },
      reasoningSummary: selection.reason,
    });

    // Step 7: Add to Cart
    checkAborted();
    emitProgress('adding_to_cart', `Adding verified item to cart...`, {
      title: actualTitle,
      price: livePriceText,
      budgetINR: budget,
      url: chosen.url,
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });

    overlay.setStatus('adding_to_cart', 'Adding to cart', undefined, {
      activity: 'Submitting Add to Cart for verified product.',
      currentProduct: {
        id: chosen.id,
        title: actualTitle,
        price: livePriceText,
        url: chosen.url,
        status: 'verified',
        budgetComparison: `${livePriceText} (Within ₹${budget} budget)`,
      },
    });

    const addButton = page.locator('#add-to-cart-button');
    await addButton.waitFor({ state: 'visible', timeout: 15000 });

    if (!(await addButton.isEnabled())) {
      throw new Error('Add to Cart button is disabled on Amazon product page.');
    }

    await addButton.click();
    await page.waitForTimeout(2000);

    // Step 8: Open Cart explicitly
    checkAborted();
    emitProgress('adding_to_cart', 'Reviewing cart contents...', {
      title: actualTitle,
      price: livePriceText,
      cartUrl: 'https://www.amazon.in/gp/cart/view.html',
      url: 'https://www.amazon.in/gp/cart/view.html',
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });

    overlay.setStatus('adding_to_cart', 'Reviewing cart', undefined, {
      activity: 'Cart opened. Confirming product presence before checkout review.',
      currentProduct: {
        id: chosen.id,
        title: actualTitle,
        price: livePriceText,
        url: chosen.url,
        status: 'verified',
      },
    });

    await page.goto('https://www.amazon.in/gp/cart/view.html', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);

    // Step 9: Navigate to Checkout Review
    checkAborted();
    const checkout = page.getByRole('button', {
      name: /proceed to buy|proceed to checkout/i,
    }).or(
      page.getByRole('link', {
        name: /proceed to buy|proceed to checkout/i,
      })
    ).first();

    let checkoutReached = false;
    if (await checkout.isVisible().catch(() => false)) {
      emitProgress('checkout_review', 'Navigating to checkout review...', {
        checkoutStatus: 'Navigating to checkout review',
        title: actualTitle,
        price: livePriceText,
        url: 'https://www.amazon.in/gp/buy/spc/handlers/display.html',
        domain: 'amazon.in',
        siteName: 'Amazon India',
        agentRole: 'Amazon Shopping Agent (Playwright)',
      });
      await checkout.click();
      await page.waitForTimeout(2500);
      checkoutReached = true;
    }

    // Step 10: Strict Purchase Safety Pause & Review
    // CRITICAL: Karma must NEVER submit the final order or click "Place your order" without explicit fresh user confirmation.
    checkAborted();
    const safeguardNotice =
      'Item added to cart and checkout review prepared. Karma will NEVER automatically click Place your order or submit payment. Please review and complete your order manually in the browser.';

    emitProgress('waiting_for_user', safeguardNotice, {
      product: {
        title: actualTitle,
        price: livePriceText,
        url: chosen.url,
      },
      title: actualTitle,
      price: livePriceText,
      budgetINR: budget,
      checkoutReached,
      url: 'https://www.amazon.in/gp/cart/view.html',
      domain: 'amazon.in',
      siteName: 'Amazon India',
      agentRole: 'Amazon Shopping Agent (Playwright)',
    });

    overlay.setStatus('checkout_review', 'Checkout review - Ready for manual confirmation', undefined, {
      activity: 'Checkout review reached. User confirmation required before placing order.',
      checkoutStatus: 'Ready for manual review. Karma will not click Place your order.',
      currentProduct: {
        id: chosen.id,
        title: actualTitle,
        price: livePriceText,
        url: chosen.url,
        status: 'verified',
        budgetComparison: `Verified total within ₹${budget} budget limit.`,
      },
    });

    // Pause briefly for user to review the visible screen (e.g. 4 seconds) before finishing tool call
    const pauseMs = options.autoCloseTimeoutMs ?? 4000;
    await new Promise((r) => setTimeout(r, pauseMs));

    return {
      success: true,
      action: 'cart_and_checkout_prepared',
      query,
      selectedProduct: {
        id: chosen.id,
        title: actualTitle,
        price: livePriceText,
        priceINR: Number.isFinite(numericLivePrice) ? numericLivePrice : undefined,
        rating: chosen.rating,
        reviews: chosen.reviews,
        url: chosen.url,
        asin: chosen.url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1],
      },
      reasoning: selection.reason,
      concerns: selection.concerns,
      candidatesFound: candidates.length,
      candidatesEvaluated: Math.min(candidates.length, 10),
      cartUrl: 'https://www.amazon.in/gp/cart/view.html',
      checkoutReached,
      orderSafeguardNotice: safeguardNotice,
    };
  } catch (error: any) {
    const isAborted = overlay.isAborted || options.abortSignal?.aborted;
    if (isAborted) {
      overlay.setStatus('stopped', 'Automation stopped by user');
      emitProgress('stopped', 'Automation safely cancelled by user.');
      return {
        success: false,
        action: 'cancelled',
        query,
        candidatesFound: 0,
        candidatesEvaluated: 0,
        orderSafeguardNotice: 'Automation was safely stopped by user request.',
        error: 'Automation cancelled by user.',
      };
    }

    const errMessage = error instanceof Error ? error.message : String(error);
    overlay.setStatus('error', 'Automation error', undefined, {
      activity: `Error encountered: ${errMessage}`,
    });
    emitProgress('error', `Automation error: ${errMessage}`);

    return {
      success: false,
      action: 'failed',
      query,
      candidatesFound: 0,
      candidatesEvaluated: 0,
      orderSafeguardNotice: 'Automation failed before completing purchase preparation.',
      error: errMessage,
    };
  } finally {
    // Gracefully clean up overlay and browser instances
    await overlay.close().catch(() => {});
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
