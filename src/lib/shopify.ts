/**
 * lib/shopify.ts — Shared Shopify GraphQL helper.
 */

const SHOPIFY_API_VERSION = "2024-01";

export function getShopifyGraphQLUrl(): string {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_SHOP_DOMAIN is not set.");
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

export function getShopifyToken(): string {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN is not set.");
  return token;
}

export async function shopifyGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = getShopifyGraphQLUrl();
  const token = getShopifyToken();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }

  const json = await res.json();

  // Surface GraphQL-level errors
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }

  return json as T;
}
