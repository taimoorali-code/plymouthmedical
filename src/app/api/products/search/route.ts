/**
 * GET /api/products/search?q=query
 *
 * Searches Shopify products by title/handle and returns the first 10 results
 * with their default variant price and first image.
 */

import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify";

const SEARCH_QUERY = `
  query searchProducts($query: String!) {
    products(first: 10, query: $query) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
        }
      }
    }
  }
`;

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string } | null;
  variants: {
    edges: {
      node: {
        id: string;
        title: string;
        price: string;
      };
    }[];
  };
}

interface SearchResponse {
  data: {
    products: {
      edges: { node: ShopifyProduct }[];
    };
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    if (!q) {
      return NextResponse.json({ products: [] });
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: "Shopify credentials are not configured." },
        { status: 500 }
      );
    }

    const data = await shopifyGraphQL<SearchResponse>(SEARCH_QUERY, { query: q });

    const products = data.data.products.edges.map(({ node }) => ({
      productId: node.id,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url ?? "",
      variants: node.variants.edges.map(({ node: v }) => ({
        variantId: v.id,
        variantTitle: v.title,
        publicPrice: v.price,
      })),
    }));

    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/products/search] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
