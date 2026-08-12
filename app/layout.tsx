import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://marianascoffee.com"),
  title: "Marianas Coffee | Earth’s Finest Coffee, Roasted in Saipan",
  description: "Earth’s Finest Coffee—born in the South Pacific and still roasted in Saipan since 2004.",
  openGraph: {
    title: "Marianas Coffee | Earth’s Finest Coffee",
    description: "Born in the South Pacific. Still roasted in Saipan since 2004.",
    url: "https://marianascoffee.com",
    siteName: "Marianas Coffee",
    locale: "en_US",
    type: "website",
  },
  icons: { icon: "/images/marianas-coffee-logo.png", shortcut: "/images/marianas-coffee-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
