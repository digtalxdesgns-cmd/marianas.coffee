"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { localeOptions, translations, type Locale } from "../translations";

const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.marianascoffee.com").replace(/\/$/, "");
const storyVisuals = [
  "linear-gradient(140deg, rgba(58,9,7,0.1), rgba(58,9,7,0.42)), url('/images/roasting-story.png')",
  "linear-gradient(140deg, rgba(58,9,7,0.14), rgba(58,9,7,0.46)), url('/images/hero-saipan-coffee.png')",
  "linear-gradient(140deg, rgba(58,9,7,0.12), rgba(58,9,7,0.4)), url('/images/coffee-collection.png')",
  "linear-gradient(140deg, rgba(58,9,7,0.14), rgba(58,9,7,0.44)), url('/images/saipan-heritage-engraving.jpg')",
] as const;

const timelineMilestones = [
  {
    label: "2004",
    title: "Where it began",
    text: "Marianas Coffee began at Chuck and Ann Jordan’s home on Saipan, inspired by the island and a passion for smooth, carefully roasted coffee.",
    image: "/images/roasting-story.png",
    alt: "Coffee roasting machine on Saipan",
  },
  {
    label: "THE FIRST BLEND",
    title: "The Original Hyatt Blend",
    text: "The first locally roasted beans were shared with the Hyatt Regency, leading to the original Hyatt Blend and bringing Saipan-roasted coffee to more people.",
    image: "/images/hero-saipan-coffee.png",
    alt: "Early Marianas Coffee story image",
  },
  {
    label: "TODAY",
    title: "Still roasted in Saipan",
    text: "More than twenty years later, every batch is still roasted on the island with the same commitment to smooth flavor and careful roasting.",
    image: "/images/coffee-collection.png",
    alt: "Three Marianas Coffee packages",
  },
  {
    label: "TODAY",
    title: "FROM SAIPAN TO THE REGION",
    text: "Still roasted in Saipan and proudly supplied across Saipan, Guam, and China.",
    image: "/images/coffee-collection.png",
    alt: "Marianas Coffee packages prepared for distribution",
  },
] as const;

const mobileCoffeeJourneySteps = [
  { number: "01", title: "SELECTED FOR SMOOTHNESS", body: "Balanced beans chosen for a smooth, aromatic cup." },
  { number: "02", title: "ROASTED ON SAIPAN", body: "Small batches roasted on island for rich, easy flavor." },
  { number: "03", title: "PACKED FRESH", body: "Freshly roasted and ready to share near and far." },
] as const;

export default function OurStoryPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);

  const t = translations[locale];
  const timelineProgress = ((activeTimelineIndex + 1) / timelineMilestones.length) * 100;
  const mobileJourneyTitle = isMobile && locale === "en" ? "THE COFFEE JOURNEY." : t.ourStory.journeyTitle;
  const mobileJourneySteps = isMobile && locale === "en" ? mobileCoffeeJourneySteps : t.ourStory.journeySteps.map((step, index) => ({
    number: `0${index + 1}`,
    title: step,
    body: index === 0
      ? "Quality beans are selected for ease, balance, and a smooth island-ready cup."
      : index === 1
        ? "Each batch is carefully roasted on Saipan to keep the flavor rich, smooth, and distinct."
        : "Fresh roasts are packed and ready to share with local tables and coffee lovers everywhere.",
  }));
  const mobileCtaTitle = isMobile && locale === "en" ? "Taste coffee born in paradise." : t.ourStory.ctaTitle;
  const mobileCtaButton = isMobile && locale === "en" ? "SHOP COFFEE" : t.ourStory.ctaButton.replace(/\s*→\s*$/, "");

  useEffect(() => {
    const saved = window.localStorage.getItem("marianas-coffee-language");
    if (saved && localeOptions.some((option) => option.value === saved)) {
      const savedLocale = saved as Locale;
      document.documentElement.lang = localeOptions.find((option) => option.value === savedLocale)?.lang ?? "en";
      const restoreLanguage = window.setTimeout(() => setLocale(savedLocale), 0);
      return () => window.clearTimeout(restoreLanguage);
    }
  }, []);

  useEffect(() => {
    const updateHeaderState = () => setHeaderScrolled(window.scrollY > 10);
    const updateViewport = () => setIsMobile(window.innerWidth <= 620);

    updateHeaderState();
    updateViewport();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("scroll", updateHeaderState);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) { return undefined; }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timelineItems = Array.from(document.querySelectorAll<HTMLElement>(".story-timeline-item"));
    if (!timelineItems.length) { return undefined; }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visibleEntries.length) {
          return;
        }

        const nextIndex = Number(visibleEntries[0].target.getAttribute("data-index"));
        setActiveTimelineIndex(nextIndex);
      },
      {
        root: null,
        threshold: prefersReducedMotion ? [0.4] : [0.2, 0.45, 0.7],
      },
    );

    timelineItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [isMobile]);

  const changeLanguage = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMenuOpen(false);
    window.localStorage.setItem("marianas-coffee-language", nextLocale);
    document.documentElement.lang = localeOptions.find((option) => option.value === nextLocale)?.lang ?? "en";
  };

  return (
    <main className="our-story-page">
      <div className="announcement">
        <span>{t.announcement}</span>
        <a className="announcement-extra announcement-link" href="/our-story">{t.watchStory} <span>→</span></a>
      </div>

      <header className={headerScrolled ? "site-header site-header--scrolled" : "site-header"}>
        <Link className="wordmark" href="/" aria-label={t.homeLabel}>
          <Image className="brand-logo header-logo" src="/images/marianas-coffee-logo.png" width={72} height={70} alt={t.brandAlt} priority />
        </Link>

        <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label={t.toggleMenu}>
          <Link href="/" onClick={() => setMenuOpen(false)}>{t.nav.home}</Link>
          <Link href="/our-story" onClick={() => setMenuOpen(false)}>{t.nav.story}</Link>
          <Link href="/#process" onClick={() => setMenuOpen(false)}>{t.nav.coffee}</Link>
          <Link href="/#wholesale" onClick={() => setMenuOpen(false)}>{t.nav.wholesale}</Link>
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
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <a className="header-shop" href={shopUrl}>{t.shopCoffee} <span>→</span></a>
          <button
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

      <section className="story-hero">
        <div className="story-hero-media" role="img" aria-label={t.ourStory.heroImageAlt} />
        <div className="story-hero-content">
          <p className="eyebrow light">{t.ourStory.heroLabel}</p>
          <h1>{isMobile && locale === "en" ? "Born and roasted in Saipan." : t.ourStory.heroTitle}</h1>
          {isMobile && locale === "en" && <span className="supporting-line">Unmistakably Marianas.</span>}
          <p>{t.ourStory.heroIntro}</p>
          {isMobile && locale === "en" && <span className="continue-indicator" aria-hidden="true">↓</span>}
        </div>
      </section>

      {isMobile ? (
        <section className="story-chronicle story-chronicle--mobile" aria-labelledby="our-story-mobile-heading">
          <div className="story-timeline-header">
            <p className="eyebrow">OUR JOURNEY</p>
            <h2 id="our-story-mobile-heading">A coffee story rooted in Saipan.</h2>
          </div>

          <div className="story-timeline" aria-label="Marianas Coffee journey timeline">
            <div className="story-timeline-progress" style={{ height: `${timelineProgress}%` }} />
            {timelineMilestones.map((milestone, index) => (
              <article
                key={milestone.title}
                className={index === activeTimelineIndex ? "story-timeline-item is-active" : "story-timeline-item"}
                data-index={index}
              >
                <div className="story-timeline-marker"><span>{index + 1}</span></div>
                <div className="story-timeline-content">
                  <p className="story-timeline-label">{milestone.label}</p>
                  <h3>{milestone.title}</h3>
                  <Image
                    className="story-timeline-photo"
                    src={milestone.image}
                    alt={milestone.alt}
                    width={600}
                    height={240}
                    style={{ objectFit: "cover", objectPosition: "center" }}
                  />
                  <p>{milestone.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="story-timeline-closing">
            <p className="story-timeline-label">INSPIRED BY SAIPAN</p>
            <p>Clear Pacific water, warm trade winds, and the relaxed island spirit continue to shape Marianas Coffee.</p>
          </div>

          <a className="button button-gold story-timeline-cta" href={shopUrl}>TASTE THE COFFEE <span>→</span></a>
        </section>
      ) : (
        <section className="story-chronicle" aria-labelledby="our-story-heading">
          <div className="story-chronicle-intro">
            <p className="eyebrow">{t.ourStory.sectionLabel}</p>
            <h2 id="our-story-heading">{t.ourStory.heroTitle}</h2>
          </div>

          {t.ourStory.sections.map((section, index) => (
            <article className="story-essay" key={section.heading}>
              <div
                className="story-essay-visual"
                role="img"
                aria-label={t.ourStory.galleryAlt}
                style={{ backgroundImage: storyVisuals[index] }}
              />
              <div className="story-essay-copy">
                <span>0{index + 1}</span>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="process-section story-page-process" id="coffee-journey">
        <div className="process-heading">
          <p className="eyebrow light">{t.ourStory.journeyTitle}</p>
          <h2>{mobileJourneyTitle}</h2>
        </div>
        <div className="process-grid">
          {mobileJourneySteps.map((step) => (
            <article key={step.title}>
              <span>{step.number}</span>
              <div className="process-icon">{["≈", "◌", "☼"][Number(step.number) - 1]}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="story-cta" aria-labelledby="story-cta-heading">
        <h2 id="story-cta-heading">{mobileCtaTitle}</h2>
        <a className="button button-gold" href={shopUrl}>{mobileCtaButton} <span>→</span></a>
      </section>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <Link href="/" aria-label={t.nav.home}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5L12 4l9 7.5v7a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1v-7Z" />
          </svg>
          <span>{t.nav.home}</span>
        </Link>
        <Link href="/our-story" aria-label={t.nav.story}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M8 7h8M8 12h8M8 17h5" />
          </svg>
          <span>{t.nav.story}</span>
        </Link>
        <Link href="/#process" aria-label={t.nav.coffee}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" />
            <path d="M6 12h12" />
            <path d="M8 4h1.5a1 1 0 0 1 0 2H8" />
            <path d="M12 4h1.5a1 1 0 0 1 0 2H12" />
          </svg>
          <span>{t.nav.coffee}</span>
        </Link>
        <Link href="/#wholesale" aria-label={t.nav.wholesale}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            <path d="m4 6 8 7 8-7" />
          </svg>
          <span>{t.nav.wholesale}</span>
        </Link>
        <a href={shopUrl} aria-label={t.nav.shop}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1.5 11.5a1 1 0 0 1-1 .9H8.5a1 1 0 0 1-1-.9L6 7Z" />
            <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          </svg>
          <span>{t.nav.shop}</span>
        </a>
      </nav>

      <footer>
        <div className="footer-brand">
          <Link className="wordmark footer-wordmark" href="/" aria-label={t.homeLabel}>
            <Image className="brand-logo footer-logo" src="/images/marianas-coffee-logo.png" width={126} height={123} alt={t.brandAlt} />
          </Link>
          <p>{t.footer.body[0]}<br />{t.footer.body[1]}</p>
        </div>
        <div className="footer-links">
          <strong>{t.footer.explore}</strong>
          <a href={shopUrl}>{t.footer.links[0]}</a>
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
