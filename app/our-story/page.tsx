import type { Metadata } from "next";
import OurStoryPage from "./OurStoryPage";
import { PAGES, SITE_NAME } from "@/lib/seo/site";

const page = PAGES.story;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: {
    title: page.title,
    description: page.description,
    url: page.path,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [page.image],
  },
  twitter: {
    card: "summary_large_image",
    title: page.title,
    description: page.description,
    images: [page.image.url],
  },
};

export default function Page() {
  return <OurStoryPage />;
}
