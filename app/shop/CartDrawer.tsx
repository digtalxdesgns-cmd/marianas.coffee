"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { formatMinorPrice } from "@/lib/woo/products";
import type { ReconciledCart } from "@/lib/woo/cart";
import type { StoreLocale } from "@/lib/woo/config";
import type { CheckoutErrorKind } from "@/lib/woo/client";
import type { ShopCopy } from "./shopTranslations";
import styles from "./shop.module.css";

type CartDrawerProps = {
  open: boolean;
  locale: StoreLocale;
  copy: ShopCopy["cart"];
  reconciled: ReconciledCart;
  reconcileNotice: { removed: boolean; adjusted: boolean };
  checkoutLoading: boolean;
  checkoutError: CheckoutErrorKind | null;
  onClose: () => void;
  onSetQuantity: (productId: number, quantity: number, maxQuantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
};

export default function CartDrawer({
  open,
  locale,
  copy,
  reconciled,
  reconcileNotice,
  checkoutLoading,
  checkoutError,
  onClose,
  onSetQuantity,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const formattedSubtotal =
    reconciled.subtotalMinor !== null && reconciled.currencyCode !== null
      ? formatMinorPrice(
          reconciled.subtotalMinor,
          reconciled.currencyCode,
          reconciled.currencyMinorUnit,
          locale,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={styles.drawerBackdrop}
        aria-label={copy.close}
        onClick={onClose}
      />

      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className={styles.drawerHeader}>
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id="cart-drawer-title">{copy.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={copy.close}
          >
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {reconcileNotice.removed && (
            <div className={styles.noticeBanner} role="status">
              {copy.reconciledRemoved}
            </div>
          )}
          {reconcileNotice.adjusted && (
            <div className={styles.noticeBanner} role="status">
              {copy.reconciledAdjusted}
            </div>
          )}
          {checkoutError && (
            <div className={styles.errorBanner} role="alert">
              {copy.checkoutErrors[checkoutError]}
            </div>
          )}

          {reconciled.items.length === 0 ? (
            <div className={styles.emptyDrawer}>
              <h3>{copy.emptyTitle}</h3>
              <p>{copy.emptyBody}</p>
              <button type="button" className="button button-dark" onClick={onClose}>
                {copy.continueShopping}
              </button>
            </div>
          ) : (
            <ul className={styles.cartList}>
              {reconciled.items.map(({ product, quantity, lineTotalMinor }) => {
                const formattedLineTotal = formatMinorPrice(
                  lineTotalMinor,
                  product.currencyCode,
                  product.currencyMinorUnit,
                  locale,
                );
                const atMax = quantity >= product.maxQuantity;

                return (
                  <li key={product.id} className={styles.cartItem}>
                    <div className={styles.cartThumb}>
                      {product.image ? (
                        <Image
                          src={product.image.src}
                          alt={product.image.alt}
                          width={72}
                          height={72}
                          unoptimized
                        />
                      ) : (
                        <Image
                          src="/images/marianas-coffee-logo.png"
                          alt={product.name}
                          width={44}
                          height={43}
                        />
                      )}
                    </div>

                    <div className={styles.cartItemInfo}>
                      <div className={styles.cartItemTop}>
                        <h3>{product.name}</h3>
                        <strong className={styles.cartLinePrice}>
                          {formattedLineTotal ?? ""}
                        </strong>
                      </div>

                      <div className={styles.cartControls}>
                        <div className={styles.qtyStepper}>
                          <button
                            type="button"
                            className={styles.qtyButton}
                            aria-label={copy.decreaseQty.replace("{product}", product.name)}
                            onClick={() => onSetQuantity(product.id, quantity - 1, product.maxQuantity)}
                            disabled={checkoutLoading}
                          >
                            −
                          </button>
                          <span className={styles.qtyValue} aria-live="polite">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            className={styles.qtyButton}
                            aria-label={copy.increaseQty.replace("{product}", product.name)}
                            onClick={() => onSetQuantity(product.id, quantity + 1, product.maxQuantity)}
                            disabled={checkoutLoading || atMax}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className={styles.removeButton}
                          aria-label={copy.removeItem.replace("{product}", product.name)}
                          onClick={() => onRemove(product.id)}
                          disabled={checkoutLoading}
                        >
                          {copy.removeLabel}
                        </button>
                      </div>

                      {atMax && (
                        <p className={styles.maxNote}>
                          {copy.maxLimitNote.replace("{max}", String(product.maxQuantity))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {reconciled.items.length > 0 && (
          <div className={styles.drawerFooter}>
            <div className={styles.subtotalRow}>
              <span>{copy.subtotal}</span>
              <strong>{formattedSubtotal ?? "—"}</strong>
            </div>
            <p className={styles.subtotalNote}>{copy.subtotalNote}</p>
            <button
              type="button"
              className={styles.checkoutButton}
              onClick={onCheckout}
              disabled={checkoutLoading}
              aria-busy={checkoutLoading}
            >
              {checkoutLoading ? copy.validating : `${copy.checkout} →`}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
