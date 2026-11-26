import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/seo/site";

// Only real, indexable pages. Languages switch on the same URL today, so there
// are no per-language URLs or hreflang alternates to list yet.
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGES).map((page) => ({
    url: page.path === "/" ? SITE_URL : `${SITE_URL}${page.path}`,
  }));
}
