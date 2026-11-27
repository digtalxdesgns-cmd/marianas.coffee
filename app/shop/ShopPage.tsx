"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { localeOptions, translations, type Locale } from "../translations";
import {
  addToCart,
  CART_STORAGE_KEY,
  cartItemCount,
  loadCart,
  reconcileCartWithCatalog,
  removeFromCart,
  saveCart,
  setCartQuantity,
  type CartLine,
} from "@/lib/woo/cart";
import {
  applyCheckoutConflictToCart,
  buildCheckoutPayload,
  parseCheckoutResponse,
  parseStoreProductsResponse,
  type CheckoutErrorKind,
} from "@/lib/woo/client";
import {
  DEFAULT_REGION,
  loadManualRegion,
  normalizeStoreRegion,
  REGION_STORAGE_KEY,
  saveManualRegion,
  SUPPORTED_REGIONS,
  type RegionSource,
  type StoreRegion,
} from "@/lib/woo/region";
import type { StoreProduct } from "@/lib/woo/products";
import { shopTranslations } from "./shopTranslations";
import CartDrawer from "./CartDrawer";
import styles from "./shop.module.css";

type CatalogState = "loading" | "ready" | "error";

export default function ShopPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [region, setRegion] = useState<StoreRegion>(DEFAULT_REGION);
  const [regionSource, setRegionSource] = useState<RegionSource>("default");
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [reconcileNotice, setReconcileNotice] = useState({ removed: false, adjusted: false });

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutErrorKind | null>(null);

  const t = translations[locale];
  const s = shopTranslations[locale];

  // Restore saved site language and browser cart on mount.
  useEffect(() => {
    const savedLocale = window.localStorage.getItem("marianas-coffee-language");
    const validLocale =
      savedLocale && localeOptions.some((option) => option.value === savedLocale)
        ? (savedLocale as Locale)
        : null;

    if (validLocale) {
      document.documentElement.lang =
        localeOptions.find((option) => option.value === validLocale)?.lang ?? "en";
    }

    const timer = window.setTimeout(() => {
      if (validLocale) setLocale(validLocale);
      setCartLines(loadCart(window.localStorage));
      const savedRegion = loadManualRegion(window.localStorage);
      if (savedRegion) {
        setRegion(savedRegion);
        setRegionSource("manual");
      }
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Resolve region dynamically from server-side geolocation headers / cookie without caching.
  // Manual localStorage or cookie selection always takes priority over auto-detection.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function resolveRegion() {
      const localManual = loadManualRegion(window.localStorage);
      if (localManual) {
        setRegion(localManual);
        setRegionSource("manual");
        // Ensure server cookie stays aligned with manual localStorage override.
        void fetch("/api/store/region", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ region: localManual }),
          signal: controller.signal,
        }).catch(() => {});
        return;
      }

      try {
        const response = await fetch("/api/store/region", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          region?: unknown;
          source?: unknown;
        } | null;
        if (!active || !response.ok || !json?.ok) return;

        const nextRegion = normalizeStoreRegion(json.region);
        const nextSource: RegionSource =
          json.source === "manual" || json.source === "detected" ? json.source : "default";
        if (nextRegion) {
          setRegion(nextRegion);
          setRegionSource(nextSource);
          if (nextSource === "manual") {
            saveManualRegion(nextRegion, window.localStorage);
          }
        }
      } catch {
        // Keep documented safe default on network error.
      }
    }

    void resolveRegion();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Keep cart and manual region synced across tabs.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) {
        setCartLines(loadCart(window.localStorage));
      } else if (event.key === REGION_STORAGE_KEY) {
        const updatedRegion = loadManualRegion(window.localStorage);
        if (updatedRegion) {
          setRegion(updatedRegion);
          setRegionSource("manual");
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Sticky header scroll shadow matching the rest of the site.
  useEffect(() => {
    const updateHeaderState = () => setHeaderScrolled(window.scrollY > 10);
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  // Load live catalog from server-side /api/store/products once saved locale is restored.
  useEffect(() => {
    if (!preferencesReady) return undefined;

    const controller = new AbortController();
    let active = true;

    async function loadProducts() {
      setCatalogState("loading");
      try {
        const response = await fetch(`/api/store/products?lang=${encodeURIComponent(locale)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const json: unknown = await response.json().catch(() => null);
        if (!active) return;

        const parsed = parseStoreProductsResponse(response.status, json);
        if (!parsed.ok) {
          setCatalogState("error");
          return;
        }

        setProducts(parsed.products);
        setCatalogState("ready");

        // Reconcile persisted cart against live catalog so stale/unavailable items are surfaced cleanly.
        setCartLines((current) => {
          if (current.length === 0) return current;
          const reconciled = reconcileCartWithCatalog(current, parsed.products);
          const cleaned = reconciled.items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          }));
          if (reconciled.droppedProductIds.length > 0 || reconciled.adjustedProductIds.length > 0) {
            setReconcileNotice({
              removed: reconciled.droppedProductIds.length > 0,
              adjusted: reconciled.adjustedProductIds.length > 0,
            });
            saveCart(cleaned, window.localStorage);
            return cleaned;
          }
          return current;
        });
      } catch {
        if (!active || controller.signal.aborted) return;
        setCatalogState("error");
      }
    }

    void loadProducts();
    return () => {
      active = false;
      controller.abort();
    };
  }, [locale, preferencesReady, reloadNonce]);

  const reconciledCart = useMemo(
    () => reconcileCartWithCatalog(cartLines, products),
    [cartLines, products],
  );

  const badgeCount = catalogState === "ready" ? reconciledCart.totalQuantity : cartItemCount(cartLines);

  const cartQtyById = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cartLines) {
      map.set(line.productId, line.quantity);
    }
    return map;
  }, [cartLines]);

  const changeLanguage = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMenuOpen(false);
    window.localStorage.setItem("marianas-coffee-language", nextLocale);
    document.documentElement.lang =
      localeOptions.find((option) => option.value === nextLocale)?.lang ?? "en";
  };

  const changeRegion = (nextRegion: StoreRegion) => {
    // Region selection is strictly independent of language and never mutates product prices.
    setRegion(nextRegion);
    setRegionSource("manual");
    saveManualRegion(nextRegion, window.localStorage);
    void fetch("/api/store/region", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ region: nextRegion }),
    }).catch(() => {});
  };

  const handleAddToCart = (product: StoreProduct) => {
    if (!product.canPurchase) return;
    setCheckoutError(null);
    setReconcileNotice({ removed: false, adjusted: false });
    setCartLines((prev) => {
      const next = addToCart(prev, product.id, 1, product.maxQuantity);
      saveCart(next, window.localStorage);
      return next;
    });
    setRecentlyAddedId(product.id);
    window.setTimeout(() => {
      setRecentlyAddedId((current) => (current === product.id ? null : current));
    }, 1400);
  };

  const handleSetQuantity = useCallback((productId: number, quantity: number, maxQuantity: number) => {
    setCheckoutError(null);
    setCartLines((prev) => {
      const next = setCartQuantity(prev, productId, quantity, maxQuantity);
      saveCart(next, window.localStorage);
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((productId: number) => {
    setCheckoutError(null);
    setCartLines((prev) => {
      const next = removeFromCart(prev, productId);
      saveCart(next, window.localStorage);
      return next;
    });
  }, []);

  const handleCheckout = useCallback(async () => {
    const activeItems = reconciledCart.items.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));
    if (activeItems.length === 0 || checkoutLoading) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const payload = buildCheckoutPayload(activeItems, locale);
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const json: unknown = await response.json().catch(() => null);
      const parsed = parseCheckoutResponse(response.status, json);

      if (!parsed.ok) {
        if (parsed.kind === "items_unavailable") {
          setCartLines((prev) => {
            const next = applyCheckoutConflictToCart(
              prev,
              parsed.unavailableProductIds,
              parsed.exceededProductIds,
              products,
            );
            saveCart(next, window.localStorage);
            return next;
          });
          setReloadNonce((n) => n + 1);
        }
        setCheckoutError(parsed.kind);
        setCheckoutLoading(false);
        return;
      }

      // Redirect strictly to the server-validated WooCommerce checkout URL.
      window.location.assign(parsed.checkoutUrl);
    } catch {
      setCheckoutError("network");
      setCheckoutLoading(false);
    }
  }, [checkoutLoading, locale, products, reconciledCart.items]);

  const openCart = () => {
    setCheckoutError(null);
    setCartOpen(true);
  };

  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, []);

  return (
    <main className={styles.shopPage}>
      <div className="announcement">
        <span>{t.announcement}</span>
        <Link className="announcement-extra announcement-link" href="/our-story">
          {t.watchStory} <span>→</span>
        </Link>
      </div>

      <header className={headerScrolled ? "site-header site-header--scrolled" : "site-header"}>
        <Link className="wordmark" href="/" aria-label={t.homeLabel}>
          <Image
            className="brand-logo header-logo"
            src="/images/marianas-coffee-logo.png"
            width={72}
            height={70}
            alt={t.brandAlt}
            priority
          />
        </Link>

        <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label={t.toggleMenu}>
          <Link href="/" onClick={() => setMenuOpen(false)}>
            {t.nav.home}
          </Link>
          <Link href="/shop" aria-current="page" onClick={() => setMenuOpen(false)}>
            {t.nav.shop}
          </Link>
          <Link href="/our-story" onClick={() => setMenuOpen(false)}>
            {t.nav.story}
          </Link>
          <Link href="/#wholesale" onClick={() => setMenuOpen(false)}>
            {t.nav.wholesale}
          </Link>
        </nav>

        <div className="header-actions">
          <label className="language-switcher">
            <span className="sr-only">{t.language}</span>
            <select
              value={locale}
              onChange={(event) => changeLanguage(event.target.value as Locale)}
              aria-label={t.language}
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={styles.cartTrigger}
            onClick={openCart}
            aria-label={`${s.openCartLabel} (${badgeCount})`}
          >
            <span className={styles.cartTriggerLabel}>{t.cart}</span>
            <span className={styles.cartBadge}>{badgeCount}</span>
          </button>

          <button
            type="button"
            className="menu-button"
            aria-label={t.toggleMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <i />
            <i />
          </button>
        </div>
      </header>

      <section className={styles.shopHero}>
        <div className={styles.shopHeroInner}>
          <div className={styles.shopHeroCopy}>
            <p className="eyebrow light">{s.eyebrow}</p>
            <h1>{s.title}</h1>
            <p>{s.subtitle}</p>
          </div>

          <div className={styles.regionBar} aria-label={s.region.label}>
            <div className={styles.regionHeaderRow}>
              <label htmlFor="shop-region-select" className={styles.regionLabel}>
                {s.region.label}
              </label>
              <span className={styles.regionSourcePill}>
                {regionSource === "manual"
                  ? s.region.sourceManual
                  : regionSource === "detected"
                    ? s.region.sourceDetected
                    : s.region.sourceDefault}
              </span>
            </div>
            <select
              id="shop-region-select"
              className={styles.regionSelect}
              value={region}
              aria-label={s.region.selectLabel}
              onChange={(event) => {
                const chosen = normalizeStoreRegion(event.target.value);
                if (chosen) changeRegion(chosen);
              }}
            >
              {SUPPORTED_REGIONS.map((code) => (
                <option key={code} value={code}>
                  {s.region[code]}
                </option>
              ))}
            </select>
            <p className={styles.regionNote}>{s.region.independenceNote}</p>
            <p className={styles.regionNote}>{s.region.pricingNote}</p>
          </div>
        </div>
      </section>

      <section className={styles.catalogSection} aria-label={s.catalogRegionLabel}>
        {catalogState === "loading" && (
          <div className={styles.catalogGrid} role="status" aria-busy="true" aria-label={s.loading}>
            {[0, 1, 2].map((index) => (
              <div key={index} className={styles.skeletonCard} aria-hidden="true">
                <div className={styles.skeletonMedia} />
                <div className={styles.skeletonBody}>
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  <div className={styles.skeletonButton} />
                </div>
              </div>
            ))}
          </div>
        )}

        {catalogState === "error" && (
          <div className={styles.stateCard} role="alert">
            <h2>{s.errorTitle}</h2>
            <p>{s.errorBody}</p>
            <button
              type="button"
              className="button button-dark"
              onClick={() => setReloadNonce((n) => n + 1)}
            >
              {s.retry}
            </button>
          </div>
        )}

        {catalogState === "ready" && products.length === 0 && (
          <div className={styles.stateCard}>
            <h2>{s.emptyTitle}</h2>
            <p>{s.emptyBody}</p>
            <Link className="button button-dark" href="/">
              {s.backHome}
            </Link>
          </div>
        )}

        {catalogState === "ready" && products.length > 0 && (
          <div className={styles.catalogGrid}>
            {products.map((product) => {
              const qtyInCart = cartQtyById.get(product.id) ?? 0;
              const atMax = qtyInCart >= product.maxQuantity;
              const isJustAdded = recentlyAddedId === product.id;

              const availabilityLabel =
                product.availability === "in_stock"
                  ? s.inStock
                  : product.availability === "out_of_stock"
                    ? s.outOfStock
                    : s.unavailable;

              const buttonLabel = !product.canPurchase
                ? product.availability === "out_of_stock"
                  ? s.outOfStock
                  : s.unavailable
                : atMax
                  ? s.maxReached
                  : isJustAdded
                    ? s.addedToCart
                    : s.addToCart;

              return (
                <article key={product.id} className={styles.productCard}>
                  <div className={styles.productMedia}>
                    {product.image ? (
                      <Image
                        className={styles.productImage}
                        src={product.image.src}
                        alt={product.image.alt}
                        fill
                        sizes="(max-width: 620px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div className={styles.productPlaceholder}>
                        <Image
                          className={styles.productPlaceholderLogo}
                          src="/images/marianas-coffee-logo.png"
                          width={68}
                          height={66}
                          alt={product.name}
                        />
                        <span>{s.productImageFallback}</span>
                      </div>
                    )}

                    {!product.canPurchase && (
                      <span
                        className={
                          product.availability === "unavailable"
                            ? `${styles.statusBadge} ${styles.statusBadgeMuted}`
                            : styles.statusBadge
                        }
                      >
                        {availabilityLabel}
                      </span>
                    )}

                    {qtyInCart > 0 && product.canPurchase && (
                      <span className={styles.inCartPill}>
                        {s.inCart.replace("{count}", String(qtyInCart))}
                      </span>
                    )}
                  </div>

                  <div className={styles.productBody}>
                    <div className={styles.productTitleRow}>
                      <h2>{product.name}</h2>
                      {product.formattedPrice ? (
                        <strong className={styles.productPrice}>{product.formattedPrice}</strong>
                      ) : (
                        <span className={styles.priceMissing}>{s.priceUnavailable}</span>
                      )}
                    </div>

                    {product.shortDescription && (
                      <p className={styles.productDescription}>{product.shortDescription}</p>
                    )}

                    <div className={styles.productFooter}>
                      <span
                        className={`${styles.availabilityLine} ${
                          product.canPurchase
                            ? styles.availabilityInStock
                            : styles.availabilityUnavailable
                        }`}
                      >
                        {availabilityLabel}
                      </span>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={
                            isJustAdded
                              ? `${styles.addButton} ${styles.addButtonAdded}`
                              : styles.addButton
                          }
                          disabled={!product.canPurchase || atMax}
                          onClick={() => handleAddToCart(product)}
                        >
                          {buttonLabel}
                        </button>

                        {qtyInCart > 0 && product.canPurchase && (
                          <button
                            type="button"
                            className={styles.viewCartInline}
                            onClick={openCart}
                          >
                            {s.viewCart}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CartDrawer
        open={cartOpen}
        locale={locale}
        copy={s.cart}
        reconciled={reconciledCart}
        reconcileNotice={reconcileNotice}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        onClose={closeCart}
        onSetQuantity={handleSetQuantity}
        onRemove={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <Link href="/" aria-label={t.nav.home}>
          <svg
            className="bottom-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11.5L12 4l9 7.5v7a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1v-7Z" />
          </svg>
          <span>{t.nav.home}</span>
        </Link>
        <Link href="/our-story" aria-label={t.nav.story}>
          <svg
            className="bottom-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M8 7h8M8 12h8M8 17h5" />
          </svg>
          <span>{t.nav.story}</span>
        </Link>
        <Link href="/shop" aria-current="page" aria-label={t.nav.shop}>
          <svg
            className="bottom-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" />
            <path d="M6 12h12" />
            <path d="M8 4h1.5a1 1 0 0 1 0 2H8" />
            <path d="M12 4h1.5a1 1 0 0 1 0 2H12" />
          </svg>
          <span>{t.nav.shop}</span>
        </Link>
        <Link href="/#wholesale" aria-label={t.nav.contact}>
          <svg
            className="bottom-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            <path d="m4 6 8 7 8-7" />
          </svg>
          <span>{t.nav.contact}</span>
        </Link>
        <button
          type="button"
          className={styles.bottomCartButton}
          onClick={openCart}
          aria-label={`${s.openCartLabel} (${badgeCount})`}
        >
          <svg
            className="bottom-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 7h12l-1.5 11.5a1 1 0 0 1-1 .9H8.5a1 1 0 0 1-1-.9L6 7Z" />
            <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          </svg>
          {badgeCount > 0 && <span className={styles.bottomCartBadge}>{badgeCount}</span>}
          <span>{t.cart}</span>
        </button>
      </nav>

      <footer>
        <div className="footer-brand">
          <Link className="wordmark footer-wordmark" href="/" aria-label={t.homeLabel}>
            <Image
              className="brand-logo footer-logo"
              src="/images/marianas-coffee-logo.png"
              width={126}
              height={123}
              alt={t.brandAlt}
            />
          </Link>
          <p>
            {t.footer.body[0]}
            <br />
            {t.footer.body[1]}
          </p>
        </div>
        <div className="footer-links">
          <strong>{t.footer.explore}</strong>
          <Link href="/shop">{t.footer.links[0]}</Link>
          <Link href="/our-story">{t.footer.links[1]}</Link>
          <Link href="/#process">{t.footer.links[2]}</Link>
          <Link href="/#wholesale">{t.footer.links[3]}</Link>
        </div>
        <div className="footer-links">
          <strong>{t.footer.contact}</strong>
          <span>{t.footer.location}</span>
          <a href="tel:+16702341000">+1 670 234 1000</a>
          <a href="tel:+16703229554">+1 670 322 9554</a>
        </div>
        <div className="footer-bottom">
          <span>{t.footer.copyright}</span>
          <span>Earth&apos;s Finest Coffee®</span>
          <span>Saipan · MP 96950</span>
        </div>
      </footer>
    </main>
  );
}
