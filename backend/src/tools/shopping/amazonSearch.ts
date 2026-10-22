
import { chromium } from "playwright";

export interface AmazonSearchInput {
    query: string;
    maxPriceINR?: number;
    limit?: number;
}

export async function amazonSearch(input: AmazonSearchInput) {
    const query = input.query?.trim();
    const maxPriceINR = input.maxPriceINR;
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);

    if (!query || query.length > 200) {
        throw new Error("Query must contain 1–200 characters.");
    }

    if (
        maxPriceINR !== undefined &&
        (!Number.isFinite(maxPriceINR) || maxPriceINR < 0)
    ) {
        throw new Error("maxPriceINR must be a valid non-negative number.");
    }

    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({
            locale: "en-IN",
        });

        const searchUrl = new URL("https://www.amazon.in/s");
        searchUrl.searchParams.set("k", query);

        await page.goto(searchUrl.toString(), {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        await page.locator('[data-component-type="s-search-result"]').first()
            .waitFor({ state: "visible", timeout: 15000 })
            .catch(() => { });

        const products = await page
            .locator('[data-component-type="s-search-result"]')
            .evaluateAll((cards) =>
                cards.map((card) => {
                    const title =
                        card.querySelector("h2 a span")?.textContent?.trim() ||
                        card.querySelector("h2 a")?.textContent?.trim() ||
                        card.querySelector("h2")?.textContent?.trim() ||
                        "";

                    const link =
                        card.querySelector<HTMLAnchorElement>("h2 a") ||
                        card.querySelector<HTMLAnchorElement>("a.a-link-normal");
                    const priceWhole =
                        card.querySelector(".a-price-whole")?.textContent ?? "";
                    const priceFraction =
                        card.querySelector(".a-price-fraction")?.textContent ?? "";
                    const priceText = `${priceWhole}${priceFraction}`.replace(
                        /[^\d.]/g,
                        "",
                    );
                    const price = priceText ? Number(priceText) : null;

                    const rating =
                        card.querySelector(".a-icon-alt")?.textContent?.trim() ?? null;
                    const reviewCount =
                        card.querySelector('[aria-label*="ratings"]')?.getAttribute(
                            "aria-label",
                        ) ??
                        card.querySelector(".s-underline-text")?.textContent?.trim() ??
                        null;

                    const asin = card.getAttribute("data-asin");
                    const href = link?.getAttribute("href");

                    return {
                        title,
                        priceINR: price && Number.isFinite(price) ? price : null,
                        rating,
                        reviewCount,
                        asin: asin || null,
                        url: href
                            ? new URL(href, "https://www.amazon.in").toString()
                            : null,
                    };
                }),
            );

        const filtered = products
            .filter((product) => product.title && product.url)
            .filter(
                (product) =>
                    maxPriceINR === undefined ||
                    (product.priceINR !== null && product.priceINR <= maxPriceINR),
            )
            .slice(0, limit);

        return {
            query,
            maxPriceINR: maxPriceINR ?? null,
            count: filtered.length,
            products: filtered,
            source: "Amazon.in",
            retrievedAt: new Date().toISOString(),
            note:
                "Prices and ratings are observed page data and may change. Verify details on Amazon before purchasing.",
        };
    } finally {
        await browser.close();
    }
}
