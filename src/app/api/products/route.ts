/**
 * GET  /api/products         — list configured private-pricing products
 * POST /api/products         — add or update a product in the config
 * DELETE /api/products?variantId=xxx — remove a product from the config
 */

import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig, PrivatePricingProduct } from "@/lib/store";

const MAX_PRODUCTS = 4;

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json({ products: config.products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body: PrivatePricingProduct (full object)
export async function POST(req: NextRequest) {
  try {
    const body: PrivatePricingProduct = await req.json();

    if (!body.variantId || !body.productId || !body.privatePrice) {
      return NextResponse.json(
        { error: "variantId, productId, and privatePrice are required." },
        { status: 400 }
      );
    }

    const config = readConfig();

    // Check limit
    const existingIdx = config.products.findIndex(
      (p) => p.variantId === body.variantId
    );

    if (existingIdx !== -1) {
      // Update existing entry
      config.products[existingIdx] = body;
    } else {
      if (config.products.length >= MAX_PRODUCTS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_PRODUCTS} products allowed for private pricing.` },
          { status: 400 }
        );
      }
      config.products.push(body);
    }

    writeConfig(config);
    return NextResponse.json({ ok: true, products: config.products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
// Query param: ?variantId=gid://shopify/ProductVariant/xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      return NextResponse.json({ error: "variantId query param is required." }, { status: 400 });
    }

    const config = readConfig();
    config.products = config.products.filter((p) => p.variantId !== variantId);
    writeConfig(config);

    return NextResponse.json({ ok: true, products: config.products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Suppress unused import warning — shopifyGraphQL may be used in apply route
void shopifyGraphQL;
