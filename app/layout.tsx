import type { Metadata } from "next";
import "./globals.css";
import { PAGES, SITE_NAME, SITE_URL, jsonLdString, organizationJsonLd } from "@/lib/seo/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: PAGES.home.title,
  description: PAGES.home.description,
  robots: { index: true, follow: true },
  openGraph: {
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/images/marianas-coffee-logo.png", shortcut: "/images/marianas-coffee-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd()) }} />
      </body>
    </html>
  );
}
