import type { Metadata } from "next";
import ShopPage from "./ShopPage";
import { SITE_NAME } from "@/lib/seo/site";
import { shopTranslations } from "./shopTranslations";

const copy = shopTranslations.en;

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/shop" },
  openGraph: {
    title: copy.metaTitle,
    description: copy.metaDescription,
    url: "/shop",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
};

export default function Page() {
  return <ShopPage />;
}
