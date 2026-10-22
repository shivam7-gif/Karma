import dotenv from 'dotenv';

dotenv.config();

export type SearchProductsInput = {
  query: string;
  maxPriceINR?: number | undefined;
  limit?: number | undefined;
};

type ShoppingResult = {
  title?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  source?: string;
  rating?: number;
  reviews?: number;
};

type SerpApiResponse = {
  shopping_results?: ShoppingResult[];
  error?: string;
};

export async function searchProducts(input: SearchProductsInput) {
  let apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    dotenv.config();
    apiKey = process.env.SERPAPI_KEY;
  }

  if (!apiKey) {
    throw new Error('SERPAPI_KEY is missing from backend/.env');
  }

  const query = input.query.trim();
  const limit = input.limit ?? 5;

  if (query.length < 2 || query.length > 200) {
    throw new Error('Query must be between 2 and 200 characters.');
  }

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Shopping provider returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as SerpApiResponse;

  if (data.error) {
    throw new Error(data.error);
  }

  const products = (data.shopping_results ?? [])
    .filter((product) => {
      const productUrl = product.link || product.product_link;
      if (!product.title || !productUrl) return false;

      if (input.maxPriceINR !== undefined) {
        return (
          typeof product.extracted_price === 'number' &&
          product.extracted_price <= input.maxPriceINR
        );
      }

      return true;
    })
    .slice(0, limit)
    .map((product) => ({
      title: product.title!,
      price: product.price ?? null,
      priceINR: product.extracted_price ?? null,
      seller: product.source ?? null,
      rating: product.rating ?? null,
      reviewCount: product.reviews ?? null,
      url: (product.link || product.product_link)!,
    }));

  return {
    query,
    budgetINR: input.maxPriceINR ?? null,
    count: products.length,
    products,
    provider: 'Google Shopping via SerpAPI',
    retrievedAt: new Date().toISOString(),
  };
}
