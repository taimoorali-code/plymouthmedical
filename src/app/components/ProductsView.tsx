"use client";
/**
 * ProductsView — Manage up to 4 private-pricing products.
 *
 * Features:
 *  - List configured products with public vs private price
 *  - Search & add Shopify products (inline search)
 *  - Edit private price inline
 *  - Remove a product from the private pricing config
 */

import { useState, useEffect, useRef } from "react";
import Card from "./Card";

// ── Types ────────────────────────────────────────────────────────────────────
export interface PrivatePricingProduct {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  publicPrice: string;
  privatePrice: string;
  imageUrl: string;
  handle: string;
}

interface SearchVariant {
  variantId: string;
  variantTitle: string;
  publicPrice: string;
}

interface SearchResult {
  productId: string;
  title: string;
  handle: string;
  imageUrl: string;
  variants: SearchVariant[];
}

const MAX = 4;
const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL
  ? `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}`
  : "";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(price: string) {
  const n = parseFloat(price);
  if (isNaN(n)) return price;
  return "$" + n.toFixed(2);
}

function savingsPercent(pub: string, priv: string) {
  const p = parseFloat(pub);
  const r = parseFloat(priv);
  if (!p || !r || r >= p) return null;
  return Math.round(((p - r) / p) * 100) + "%";
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ProductsView() {
  const [products, setProducts] = useState<PrivatePricingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // variantId being saved
  const [removing, setRemoving] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState<Record<string, string>>({}); // variantId -> draft price

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [addingVariant, setAddingVariant] = useState<string | null>(null);
  const [newPrivatePrices, setNewPrivatePrices] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Load configured products ───────────────────────────────────────────────
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data.products ?? []);
      // Seed edit prices from current config
      const ep: Record<string, string> = {};
      (data.products ?? []).forEach((p: PrivatePricingProduct) => {
        ep[p.variantId] = p.privatePrice;
      });
      setEditPrices(ep);
    } catch {
      setStatusMsg({ type: "err", text: "Failed to load products." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  // ── Search with debounce ───────────────────────────────────────────────────
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  // ── Save private price for an existing product ─────────────────────────────
  const handleSavePrice = async (product: PrivatePricingProduct) => {
    const price = editPrices[product.variantId] ?? product.privatePrice;
    if (!price || isNaN(parseFloat(price))) {
      setStatusMsg({ type: "err", text: "Please enter a valid price." });
      return;
    }
    setSaving(product.variantId);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, privatePrice: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products);
      setStatusMsg({ type: "ok", text: `Price updated for "${product.title}".` });
    } catch (e: unknown) {
      setStatusMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(null);
    }
  };

  // ── Remove a product from config ───────────────────────────────────────────
  const handleRemove = async (variantId: string, title: string) => {
    if (!confirm(`Remove "${title}" from private pricing?`)) return;
    setRemoving(variantId);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/products?variantId=${encodeURIComponent(variantId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products);
      setStatusMsg({ type: "ok", text: `"${title}" removed from private pricing.` });
    } catch (e: unknown) {
      setStatusMsg({ type: "err", text: e instanceof Error ? e.message : "Remove failed." });
    } finally {
      setRemoving(null);
    }
  };

  // ── Add a product from search results ──────────────────────────────────────
  const handleAddProduct = async (
    result: SearchResult,
    variant: SearchVariant
  ) => {
    const privatePrice = newPrivatePrices[variant.variantId];
    if (!privatePrice || isNaN(parseFloat(privatePrice))) {
      setStatusMsg({ type: "err", text: "Enter a private price before adding." });
      return;
    }
    setAddingVariant(variant.variantId);
    setStatusMsg(null);
    try {
      const payload: PrivatePricingProduct = {
        productId: result.productId,
        variantId: variant.variantId,
        title: result.title,
        variantTitle: variant.variantTitle === "Default Title" ? "" : variant.variantTitle,
        publicPrice: variant.publicPrice,
        privatePrice,
        imageUrl: result.imageUrl,
        handle: result.handle,
      };
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products);
      const ep: Record<string, string> = { ...editPrices };
      ep[variant.variantId] = privatePrice;
      setEditPrices(ep);
      setNewPrivatePrices((prev) => { const n = { ...prev }; delete n[variant.variantId]; return n; });
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setStatusMsg({ type: "ok", text: `"${result.title}" added to private pricing.` });
    } catch (e: unknown) {
      setStatusMsg({ type: "err", text: e instanceof Error ? e.message : "Add failed." });
    } finally {
      setAddingVariant(null);
    }
  };

  const alreadyAdded = (variantId: string) =>
    products.some((p) => p.variantId === variantId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Status banner */}
      {statusMsg && (
        <div
          className={`sync-banner ${statusMsg.type === "ok" ? "sync-banner--success" : "sync-banner--error"}`}
          role="status"
          style={{ marginBottom: 16 }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* ── Configured products ── */}
      <Card
        title="Private Pricing Products"
        subtitle={`Configure up to ${MAX} products with exclusive fixed rates for approved customers. Non-approved visitors will not see these prices.`}
        action={
          products.length < MAX ? (
            <button
              id="add-product-btn"
              className="btn btn--solid"
              onClick={() => { setShowSearch((v) => !v); setStatusMsg(null); }}
            >
              {showSearch ? "Cancel" : "+ Add Product"}
            </button>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              Max {MAX} products reached
            </span>
          )
        }
      >
        {/* ── Inline search panel ── */}
        {showSearch && (
          <div style={{ marginBottom: 16 }}>
            <label className="field" htmlFor="product-search">
              <span className="field__label">Search Shopify Products</span>
              <input
                id="product-search"
                className="input"
                type="text"
                placeholder="Type product name…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
              />
            </label>

            {searching && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Searching…</p>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) =>
                  result.variants.map((v) => {
                    const added = alreadyAdded(v.variantId);
                    return (
                      <div key={v.variantId} className="search-result-row">
                        {result.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={result.imageUrl}
                            alt={result.title}
                            className="search-result-img"
                          />
                        ) : (
                          <div className="search-result-img search-result-img--placeholder" />
                        )}
                        <div className="search-result-info">
                          <span className="search-result-title">
                            {result.title}
                            {v.variantTitle && v.variantTitle !== "Default Title" && (
                              <span className="muted"> — {v.variantTitle}</span>
                            )}
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            Public price: {fmt(v.publicPrice)}
                          </span>
                        </div>
                        {added ? (
                          <span className="badge badge--ok" style={{ flexShrink: 0 }}>Added</span>
                        ) : (
                          <div className="search-result-add">
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Private $"
                              style={{ width: 120 }}
                              value={newPrivatePrices[v.variantId] ?? ""}
                              onChange={(e) =>
                                setNewPrivatePrices((prev) => ({
                                  ...prev,
                                  [v.variantId]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="btn btn--solid"
                              disabled={addingVariant === v.variantId}
                              onClick={() => handleAddProduct(result, v)}
                            >
                              {addingVariant === v.variantId ? "Adding…" : "Add"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                No products found for &ldquo;{searchQuery}&rdquo;.
              </p>
            )}
          </div>
        )}

        {/* ── Product cards ── */}
        {loading ? (
          <p className="muted" style={{ fontSize: 13, padding: "16px 0" }}>
            Loading products…
          </p>
        ) : products.length === 0 ? (
          <div className="empty-products">
            <p>No private-pricing products configured yet.</p>
            <p className="muted" style={{ fontSize: 13 }}>
              Click &ldquo;+ Add Product&rdquo; to search your Shopify catalogue and set exclusive prices.
            </p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => {
              const savings = savingsPercent(p.publicPrice, editPrices[p.variantId] ?? p.privatePrice);
              return (
                <div key={p.variantId} className="product-card">
                  {/* Image */}
                  <div className="product-card__img-wrap">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.title} className="product-card__img" />
                    ) : (
                      <div className="product-card__img product-card__img--placeholder" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="product-card__body">
                    <div className="product-card__head">
                      <div>
                        <p className="product-card__title">{p.title}</p>
                        {p.variantTitle && (
                          <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                            Variant: {p.variantTitle}
                          </p>
                        )}
                      </div>
                      <div className="product-card__prices">
                        <span className="product-card__public-price">
                          Public: {fmt(p.publicPrice)}
                        </span>
                        {savings && (
                          <span className="badge badge--ok" style={{ fontSize: 11 }}>
                            -{savings} off
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Private price editor */}
                    <div className="product-card__price-row">
                      <label
                        htmlFor={`price-${p.variantId}`}
                        className="field__label"
                        style={{ margin: 0, alignSelf: "center" }}
                      >
                        Private Price ($)
                      </label>
                      <input
                        id={`price-${p.variantId}`}
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        style={{ maxWidth: 140 }}
                        value={editPrices[p.variantId] ?? p.privatePrice}
                        onChange={(e) =>
                          setEditPrices((prev) => ({
                            ...prev,
                            [p.variantId]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="btn btn--solid"
                        disabled={saving === p.variantId}
                        onClick={() => handleSavePrice(p)}
                      >
                        {saving === p.variantId ? "Saving…" : "Save Price"}
                      </button>
                    </div>

                    {/* Footer actions */}
                    <div className="product-card__footer">
                      {STORE_URL && (
                        <a
                          href={`${STORE_URL}/products/${p.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--ghost"
                          style={{ fontSize: 12 }}
                        >
                          View in Store ↗
                        </a>
                      )}
                      <button
                        className="btn btn--danger"
                        disabled={removing === p.variantId}
                        onClick={() => handleRemove(p.variantId, p.title)}
                      >
                        {removing === p.variantId ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: MAX - products.length }).map((_, i) => (
              <div key={`empty-${i}`} className="product-card product-card--empty">
                <span className="muted" style={{ fontSize: 13 }}>
                  Empty slot {products.length + i + 1} of {MAX}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── How private pricing works ── */}
      <Card
        title="How Private Pricing Works"
        subtitle="What happens behind the scenes when you configure a product."
      >
        <div className="how-it-works">
          <div className="how-step">
            <span className="how-step__num">1</span>
            <div>
              <strong>Import approved customers</strong>
              <p className="muted">Go to Customers → Import from your Google Sheet. Each imported customer is tagged <code className="tag">private_pricing_approved</code> in Shopify.</p>
            </div>
          </div>
          <div className="how-step">
            <span className="how-step__num">2</span>
            <div>
              <strong>Set private prices here</strong>
              <p className="muted">Add up to 4 products and set the exclusive price each approved customer will see after logging in.</p>
            </div>
          </div>
          <div className="how-step">
            <span className="how-step__num">3</span>
            <div>
              <strong>Shopify theme (one-time setup)</strong>
              <p className="muted">Your Shopify store theme needs to check the customer&apos;s <code className="tag">private_pricing_approved</code> tag and show the private price. Contact your Shopify developer to add this logic to the product page template — or use the Shopify Script Editor / B2B pricing if on Shopify Plus.</p>
            </div>
          </div>
          <div className="how-step">
            <span className="how-step__num">4</span>
            <div>
              <strong>Non-approved visitors</strong>
              <p className="muted">Visitors who are not logged in or don&apos;t have the tag are redirected to the <strong>Contact Sales</strong> page on your Shopify store (configured in your theme).</p>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
