/**
 * lib/store.ts — Simple file-based persistent config store.
 *
 * Stores the private-pricing product configuration in
 * `<project-root>/data/products-config.json`.
 * This is appropriate for a single-server deployment.
 * Swap this out for a DB (e.g. Prisma + SQLite/Postgres) when needed.
 */

import fs from "fs";
import path from "path";

export interface PrivatePricingProduct {
  productId: string;          // gid://shopify/Product/xxx
  variantId: string;          // gid://shopify/ProductVariant/xxx
  title: string;
  variantTitle: string;
  publicPrice: string;        // original Shopify price (string, e.g. "99.99")
  privatePrice: string;       // admin-set price shown to approved customers
  imageUrl: string;
  handle: string;             // Shopify product handle (for store link)
}

interface Config {
  products: PrivatePricingProduct[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "products-config.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): Config {
  ensureDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return { products: [] };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return { products: [] };
  }
}

export function writeConfig(config: Config): void {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
