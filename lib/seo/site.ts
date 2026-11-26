// Single source for public site facts used in metadata and structured data.
// Every value here is already published on the site itself; do not add
// details (hours, street address, ratings, prices) until the owner confirms them.

export const SITE_URL = "https://marianascoffee.com";
export const SITE_NAME = "Marianas Coffee";

export const PAGES = {
  home: {
    path: "/",
    title: "Marianas Coffee | Earth’s Finest Coffee, Roasted in Saipan",
    description:
      "Earth’s Finest Coffee, roasted on Saipan since 2004. Discover Marianas Coffee island roasts, our story, and wholesale coffee for hotels, cafés and offices.",
    image: { url: "/images/hero-desktop.png", width: 1672, height: 941, alt: "Marianas Coffee bag beside a coffee roaster on Saipan" },
  },
  story: {
    path: "/our-story",
    title: "Our Story | Marianas Coffee",
    description:
      "Marianas Coffee began in 2004 at Chuck and Ann Jordan’s home on Saipan. More than twenty years later, every batch is still roasted on the island.",
    image: { url: "/images/roasting-story.png", width: 1536, height: 1024, alt: "Coffee roasting on Saipan" },
  },
} as const;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/images/marianas-coffee-logo.png`,
          width: 474,
          height: 463,
        },
        slogan: "Earth’s Finest Coffee",
        foundingDate: "2004",
        foundingLocation: { "@type": "Place", name: "Saipan, Northern Mariana Islands" },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Saipan",
          addressRegion: "MP",
          postalCode: "96950",
          addressCountry: "MP",
        },
        telephone: ["+1-670-234-1000", "+1-670-322-9554"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" injection. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
