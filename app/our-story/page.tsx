import type { Metadata } from "next";
import OurStoryPage from "./OurStoryPage";

export const metadata: Metadata = {
  title: "Our Story | Marianas Coffee",
  description: "The story of Marianas Coffee began on Saipan in 2004 and still continues with island-roasted coffee inspired by the South Pacific.",
  openGraph: {
    title: "Our Story | Marianas Coffee",
    description: "Born here. Roasted here. Unmistakably Marianas.",
    url: "https://marianascoffee.com/our-story",
    siteName: "Marianas Coffee",
    locale: "en_US",
    type: "website",
  },
};

export default function Page() {
  return <OurStoryPage />;
}
