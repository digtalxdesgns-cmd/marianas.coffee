import {
  commerceDictionary,
  getStorefrontCopy,
  type StorefrontCopy,
} from "../../lib/i18n/commerce.ts";
import type { StoreLocale } from "../../lib/woo/config.ts";

export type ShopCopy = StorefrontCopy;

export const shopTranslations: Record<StoreLocale, ShopCopy> = commerceDictionary.storefront;

export { getStorefrontCopy };
