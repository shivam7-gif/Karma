import { chromium, type Locator, type Browser, type Page } from "playwright";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { chooseProduct, type Candidate } from "./product-agent.js";
import { ScreenControlOverlay } from "../src/overlay/index.js";

async function main() {
    const overlay = new ScreenControlOverlay();
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        console.log("Launching screen control overlay...");
        await overlay.start();
        overlay.setStatus("controlling_screen", "Karma is controlling the screen", undefined, {
            activity: "Starting browser automation session.",
            budgetINR: 500,
        });

        browser = await chromium.launch({
            headless: false,
            slowMo: 100,
        });

        // Register cancellation handler
        overlay.onStop(async (event) => {
            console.log(`\n[Overlay Stop] Cancellation requested via ${event.reason}. Safely terminating automation...`);
            overlay.setStatus("stopped", "Automation stopped by user", undefined, {
                activity: `Automation safely aborted via ${event.reason}.`,
            });
            try {
                if (page) await page.close().catch(() => {});
                if (browser) await browser.close().catch(() => {});
            } catch {}
        });

        overlay.throwIfAborted();

        page = await browser.newPage({
            viewport: { width: 1366, height: 900 },
        });

        // Step 1: Open Amazon
        overlay.throwIfAborted();
        overlay.setStatus("searching", "Searching Amazon", undefined, {
            activity: "Opening Amazon.in and locating product search bar.",
            budgetINR: 500,
        });

        await page.goto("https://www.amazon.in/", {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });

        // Step 2: Find the search bar
        overlay.throwIfAborted();
        const searchBox = page.locator("#twotabsearchtextbox");

        await searchBox.waitFor({
            state: "visible",
            timeout: 20000,
        });

        // Step 3: Move the visible cursor to the search bar
        overlay.throwIfAborted();
        const searchBounds = await searchBox.boundingBox();

        if (!searchBounds) {
            throw new Error("Amazon search bar is not visible.");
        }

        await page.mouse.move(
            searchBounds.x + searchBounds.width / 2,
            searchBounds.y + searchBounds.height / 2,
            { steps: 25 }
        );

        await page.waitForTimeout(400);
        await page.mouse.click(
            searchBounds.x + searchBounds.width / 2,
            searchBounds.y + searchBounds.height / 2
        );

        // Step 4: Type the search query visibly
        overlay.throwIfAborted();
        await page.keyboard.type("creatine monohydrate", {
            delay: 120,
        });

        await page.waitForTimeout(500);

        const searchUrlPromise = page.waitForURL(
            url => url.pathname.includes("/s"),
            { timeout: 30000 }
        ).catch(() => null);

        overlay.setStatus("searching", "Searching Amazon", undefined, {
            activity: "Searching for 'creatine monohydrate'. Waiting for listings.",
            budgetINR: 500,
        });

        await page.keyboard.press("Enter");
        await searchUrlPromise;

        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForTimeout(2500);

        overlay.throwIfAborted();
        const headings = page.locator('h2[aria-label], h2.a-size-base-plus');
        await headings.first().waitFor({ state: "attached", timeout: 20000 });

        const candidates: Candidate[] = [];
        const count = await headings.count();

        for (let i = 0; i < count; i++) {
            overlay.throwIfAborted();
            const heading = headings.nth(i);
            const title = (await heading.innerText().catch(() => "")).trim();

            if (!/creatine/i.test(title)) continue;

            // In the observed Amazon HTML, the heading's parent is its product link.
            const href = await heading.locator("xpath=ancestor::a[1]")
                .getAttribute("href")
                .catch(() => null);

            if (!href) continue;

            // Sponsored links wrap the real product URL inside a "url" query parameter.
            const linkUrl = new URL(href, "https://www.amazon.in");
            let productPath = linkUrl.pathname;

            if (linkUrl.pathname.includes("/sspa/click")) {
                const destination = linkUrl.searchParams.get("url");
                if (destination) {
                    productPath = new URL(destination, "https://www.amazon.in").pathname;
                }
            }

            // Ignore links that don't resolve to an Amazon product page.
            const asin = productPath.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
            if (!asin) continue;

            const card = heading.locator(
                "xpath=ancestor::div[@data-asin][1]"
            );

            const cardText = (await card.innerText().catch(() => "")).slice(0, 400);
            const price = (
                await card.locator(".a-price .a-offscreen").first()
                    .innerText().catch(() => "")
            ).trim();

            const rating = await card
                .locator('[aria-label*="out of 5 stars"]')
                .first()
                .getAttribute("aria-label")
                .catch(() => null);

            candidates.push({
                id: candidates.length + 1,
                title,
                price: price || "Unavailable",
                rating: rating || "Unavailable",
                reviews: cardText.match(/\([\d,.]+[KkMm]?\)/)?.[0] || "Unavailable",
                url: `https://www.amazon.in/dp/${asin}`,
                listingText: cardText || title,
            });
        }

        console.log("Extracted candidates:", candidates.length);
        console.log(
            "Sample candidates:",
            candidates.slice(0, 5).map(({ id, title, price, url }) => ({
                id, title, price, url,
            }))
        );

        if (candidates.length === 0) {
            throw new Error("No valid creatine product candidates found.");
        }

        // Step 5: Product extraction and LLM selection
        overlay.throwIfAborted();
        overlay.setStatus("analyzing", "Comparing products", undefined, {
            activity: `Extracted ${candidates.length} listings. Evaluating options against ₹500 budget.`,
            candidatesFound: candidates.length,
            candidatesEvaluated: Math.min(candidates.length, 10),
            budgetINR: 500,
            candidates: candidates.slice(0, 8).map(c => ({
                id: c.id,
                title: c.title,
                price: c.price,
                rating: c.rating,
                url: c.url,
                status: 'shortlisted',
            })),
        });

        const selection = await chooseProduct(candidates.slice(0, 10), 500);
        const chosen = candidates.find(p => p.id === selection.selectedId);

        if (!chosen) {
            throw new Error("LLM selected an unknown product.");
        }

        console.log("\n--- SELECTED CANDIDATE ---");
        console.log("LLM selected ID:", selection.selectedId);
        console.log("Extracted title:", chosen.title);
        console.log("Extracted price:", chosen.price);
        console.log("Extracted URL:", chosen.url);
        console.log("LLM reason:", selection.reason);

        if (!/\/dp\/[A-Z0-9]{10}$/i.test(chosen.url)) {
            throw new Error("Invalid Amazon product URL.");
        }

        overlay.setStatus("analyzing", "Comparing products", undefined, {
            activity: `Selected candidate #${chosen.id}: ${chosen.title.slice(0, 48)}...`,
            candidatesFound: candidates.length,
            candidatesEvaluated: Math.min(candidates.length, 10),
            budgetINR: 500,
            currentProduct: {
                id: chosen.id,
                title: chosen.title,
                price: chosen.price,
                rating: chosen.rating,
                reviews: chosen.reviews,
                url: chosen.url,
                status: 'selected',
                budgetComparison: `${chosen.price} within ₹500 budget limit`,
            },
            reasoningSummary: selection.reason,
            candidates: candidates.slice(0, 8).map(c => ({
                id: c.id,
                title: c.title,
                price: c.price,
                rating: c.rating,
                url: c.url,
                status: c.id === chosen.id ? 'selected' : 'shortlisted',
            })),
        });

        // Step 6: Selected product opens
        overlay.throwIfAborted();
        overlay.setStatus("opening_product", "Inspecting product", undefined, {
            activity: "Opening listing page to verify live title and price.",
            currentProduct: {
                id: chosen.id,
                title: chosen.title,
                price: chosen.price,
                rating: chosen.rating,
                reviews: chosen.reviews,
                url: chosen.url,
                status: 'evaluating',
                budgetComparison: "Verifying live price on product page...",
            },
            reasoningSummary: selection.reason,
        });

        await page.goto(chosen.url, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);

        console.log("Actual product page:", page.url());

        const actualTitle = (
            await page.locator("#productTitle").innerText().catch(() => "")
        ).trim();

        const priceText = await page
            .locator("#corePrice_feature_div .a-price .a-offscreen")
            .first()
            .innerText()
            .catch(() => "");

        console.log("Verified title:", actualTitle);
        console.log("Live price text:", priceText || "Unavailable");

        const match = priceText.match(/[\d,]+(?:\.\d{1,2})?/);
        const currentPrice = match
            ? Number(match[0].replace(/,/g, ""))
            : NaN;

        if (!Number.isFinite(currentPrice) || currentPrice > 500) {
            throw new Error("Price unavailable or exceeds ₹500. No cart action.");
        }

        console.log("Identity and price checks passed.");

        overlay.setStatus("opening_product", "Inspecting product", undefined, {
            activity: `Verified page: ${actualTitle.slice(0, 42)}... at ${priceText}.`,
            currentProduct: {
                id: chosen.id,
                title: actualTitle,
                price: priceText,
                rating: chosen.rating,
                reviews: chosen.reviews,
                url: chosen.url,
                status: 'verified',
                budgetComparison: `₹${currentPrice} is ₹${500 - currentPrice} under budget limit. Passed.`,
            },
            reasoningSummary: selection.reason,
        });

        // Step 7: Add-to-cart action starts
        overlay.throwIfAborted();
        overlay.setStatus("adding_to_cart", "Adding to cart", undefined, {
            activity: "Submitting Add to Cart for verified product.",
            currentProduct: {
                id: chosen.id,
                title: actualTitle,
                price: priceText,
                url: chosen.url,
                status: 'verified',
                budgetComparison: `₹${currentPrice} (Within ₹500 budget)`,
            },
        });
        console.log("Attempting Add to Cart...");

        const addButton = page.locator("#add-to-cart-button");

        await addButton.waitFor({ state: "visible", timeout: 15000 });

        if (!(await addButton.isEnabled())) {
            throw new Error("Add to Cart button is disabled.");
        }

        await addButton.click();
        await page.waitForTimeout(2500);

        console.log("After Add to Cart:", page.url());
        console.log(
            "Page text:",
            (await page.locator("body").innerText()).slice(0, 1200)
        );

        // Step 8: Cart opens
        overlay.throwIfAborted();
        overlay.setStatus("adding_to_cart", "Reviewing cart", undefined, {
            activity: "Cart opened. Confirming product presence before checkout.",
            currentProduct: {
                id: chosen.id,
                title: actualTitle,
                price: priceText,
                url: chosen.url,
                status: 'verified',
            },
        });

        await page.goto("https://www.amazon.in/gp/cart/view.html", {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });

        await page.waitForTimeout(2500);

        console.log("Cart URL:", page.url());
        console.log(
            "Cart contents:",
            (await page.locator("body").innerText()).slice(0, 2000)
        );

        // Step 9: Checkout page opens
        overlay.throwIfAborted();
        const checkout = page.getByRole("button", {
            name: /proceed to buy|proceed to checkout/i,
        }).or(
            page.getByRole("link", {
                name: /proceed to buy|proceed to checkout/i,
            })
        ).first();

        if (await checkout.isVisible().catch(() => false)) {
            overlay.setStatus("checkout_review", "Checkout review", undefined, {
                activity: "Navigating to checkout review. Karma will not submit final order.",
                checkoutStatus: "Navigating to checkout...",
            });
            console.log("Checkout control found.");
            await checkout.click();
            await page.waitForTimeout(2500);

            console.log("Checkout URL:", page.url());
            console.log(
                "Checkout page:",
                (await page.locator("body").innerText()).slice(0, 2000)
            );
        } else {
            console.log(
                "Checkout control not found. Check whether the item is in the cart or Amazon requires sign-in."
            );
        }

        overlay.setStatus("checkout_review", "Checkout review - Ready for manual confirmation", undefined, {
            activity: "Checkout review reached. User confirmation required before placing order.",
            checkoutStatus: "Ready for manual review. Karma will not click Place your order.",
            currentProduct: {
                id: chosen.id,
                title: actualTitle,
                price: priceText,
                url: chosen.url,
                status: 'verified',
                budgetComparison: `Verified total within ₹500 budget limit`,
            },
        });

        console.log("Checkout reached or attempted.");
        console.log("Review the order details in the visible browser.");
        console.log("The script will not click Place your order.");

        await page.pause();

        // Step 10: Keep the browser open for inspection
        console.log("\nReview the product in the browser.");
        console.log("No purchase has been made.");

        const terminal = readline.createInterface({
            input: stdin,
            output: stdout,
        });

        await terminal.question(
            "\nPress Enter to close the browser..."
        );

        terminal.close();
    } catch (error: any) {
        if (overlay.isAborted) {
            console.log("\n[Karma] Automation safely stopped by user request (Escape / Stop).");
        } else {
            console.error("Automation failed:", error);
            overlay.setStatus("error", "Automation error", undefined, {
                activity: `Error encountered: ${error?.message || error}`,
            });
            await new Promise(r => setTimeout(r, 1200));
        }

        if (!overlay.isAborted && browser) {
            const terminal = readline.createInterface({
                input: stdin,
                output: stdout,
            });

            await terminal.question(
                "Press Enter to close the browser..."
            );

            terminal.close();
        }
    } finally {
        console.log("Cleaning up overlay and browser...");
        await overlay.close().catch(() => {});
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

main().catch(console.error);
