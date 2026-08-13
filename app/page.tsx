"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { localeOptions, translations, type Locale } from "./translations";

const processIcons = ["≈", "◌", "☼"];
const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.marianascoffee.com").replace(/\/$/, "");

const productImages = [
  {
    src: "/images/products/Medium-Roast.png",
    alt: "Marianas Coffee Medium Roast bag",
  },
  {
    src: "/images/products/Dark-Roast.png",
    alt: "Marianas Coffee Dark Roast bag",
  },
  {
    src: "/images/products/Signature.png",
    alt: "Marianas Coffee Signature blend bag",
  },
] as const;

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [wholesaleSent, setWholesaleSent] = useState(false);
  const [emailJoined, setEmailJoined] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filmVideoOpen, setFilmVideoOpen] = useState(false);
  const [wholesaleModalOpen, setWholesaleModalOpen] = useState(false);
  const wholesaleButtonRef = useRef<HTMLButtonElement>(null);
  const wholesaleCloseRef = useRef<HTMLButtonElement>(null);

  const t = translations[locale];

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

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth <= 620);

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!wholesaleModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    wholesaleCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWholesaleModalOpen(false);
      }

      if (event.key === "Tab" && wholesaleCloseRef.current) {
        const focusable = Array.from(
          document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            ".wholesale-modal [tabindex]:not([tabindex='-1']), .wholesale-modal button, .wholesale-modal input, .wholesale-modal select, .wholesale-modal textarea",
          ),
        );

        if (!focusable.length) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [wholesaleModalOpen]);

  const changeLanguage = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMenuOpen(false);
    window.localStorage.setItem("marianas-coffee-language", nextLocale);
    document.documentElement.lang = localeOptions.find((option) => option.value === nextLocale)?.lang ?? "en";
  };

  return (
    <main>
      <div className="announcement">
        <span>{t.announcement}</span>
        <a className="announcement-extra announcement-link" href="/our-story">{t.watchStory} <span>→</span></a>
      </div>

      <header className={headerScrolled ? "site-header site-header--scrolled" : "site-header"}>
        <a className="wordmark" href="#top" aria-label={t.homeLabel}>
          <Image className="brand-logo header-logo" src="/images/marianas-coffee-logo.png" width={72} height={70} alt={t.brandAlt} priority />
        </a>

        <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label={t.toggleMenu}>
          <a href="#top" onClick={() => setMenuOpen(false)}>{t.nav.home}</a>
          <a href="/our-story" onClick={() => setMenuOpen(false)}>{t.nav.story}</a>
          <a href="#collection" onClick={() => setMenuOpen(false)}>{t.nav.coffee}</a>
          <a href="#wholesale" onClick={() => setMenuOpen(false)}>{t.nav.wholesale}</a>
        </nav>

        <div className="header-actions">
          <label className="language-switcher">
            <span className="sr-only">{t.language}</span>
            <select
              value={locale}
              onChange={(event) => changeLanguage(event.target.value as Locale)}
              aria-label={t.language}
            >
              {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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

      <section className="hero" id="top">
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow light">{t.heroEyebrow}</p>
          <h1>{t.heroTitle[0]}<br />{t.heroTitle[1]}</h1>
          <p className="hero-copy">{t.heroCopy}</p>
          <div className="hero-actions">
            <a className="button button-gold" href={shopUrl}>{t.shopCoffee} <span>→</span></a>
            <a className="text-link light-link" href="/our-story">{t.discoverStory} <span>↘</span></a>
          </div>
        </div>
        <div className="hero-origin">
          <span>{t.heroOrigin[0]}</span>
          <span>{t.heroOrigin[1]}</span>
          <strong>{t.heroOrigin[2]}</strong>
        </div>
      </section>

      <section className="intro-strip" aria-label="Brand values">
        {t.values.map((value, index) => (
          <div key={value.title}>
            <span>0{index + 1}</span><strong>{value.title}</strong><p>{value.body}</p>
          </div>
        ))}
      </section>

      <section className="film-section" id="film">
        {isMobile ? (
          <div className="film-mobile">
            <p className="eyebrow">{t.film.eyebrow}</p>
            <h2>The island behind Earth’s Finest Coffee.</h2>
            <p>Born in Saipan in 2004, Marianas Coffee is shaped by clear Pacific water, warm trade winds, and the island’s relaxed rhythm. Every batch is still roasted here.</p>
            <div className="film-mobile-video-head">OUR ISLAND STORY · MARIANAS COFFEE, SAIPAN.</div>
            {filmVideoOpen ? (
              <div className="film-mobile-video video-open">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/2KTV1iakKk8?rel=0&autoplay=1"
                  title={t.film.videoTitle}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                type="button"
                className="film-mobile-video"
                aria-label="Play the Marianas Coffee story video"
                onClick={() => setFilmVideoOpen(true)}
                style={{ backgroundImage: "url('https://img.youtube.com/vi/2KTV1iakKk8/hqdefault.jpg')" }}
              />
            )}
          </div>
        ) : (
          <>
            <div className="film-copy">
              <p className="eyebrow">{t.film.eyebrow}</p>
              <h2>{t.film.title}</h2>
              <p>{t.film.body}</p>
              <div className="film-details" aria-label="Video highlights">
                {t.film.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
            </div>
            <div className="film-frame">
              <div className="film-frame-top">
                <span>{t.film.frameTitle}</span>
                <span>{t.film.frameMeta}</span>
              </div>
              <div className="video-wrap">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/2KTV1iakKk8?rel=0"
                  title={t.film.videoTitle}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </>
        )}
      </section>

      <section className="shop-preview section" id="shop">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">{t.shop.eyebrow}</p><h2>{t.shop.title}</h2></div>
          <a className="text-link" href={shopUrl}>{t.shop.all} <span>→</span></a>
        </div>

        <div className="product-grid">
          {t.shop.products.map((coffee, index) => {
            const productImage = productImages[index] ?? productImages[0];

            return (
              <article className="product-card" key={coffee.name}>
                <div
                  className={`product-visual ${coffee.tone}`}
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  <Image
                    className="product-photo"
                    src={productImage.src}
                    alt={productImage.alt}
                    fill
                    sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  {index === 1 && <span className="badge">{t.shop.bestseller}</span>}
                  <a
                    className="quick-add"
                    href={shopUrl}
                    aria-label={t.shop.addLabel.replace("{product}", coffee.name)}
                  >
                    {t.shop.quickAdd}
                  </a>
                </div>
                <div className="product-meta">
                  <div><h3>{coffee.name}</h3><p>{coffee.note}</p></div>
                  <strong>{coffee.price}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="story-section" id="story">
        <div className="story-image" role="img" aria-label={t.story.imageLabel}>
          <div className="story-year"><span>{t.story.established}</span><strong>2004</strong><small>Saipan, MP</small></div>
        </div>
        <div className="story-copy">
          <p className="eyebrow">{t.story.eyebrow}</p>
          <h2>{t.story.title}</h2>
          <p className="story-lead">{t.story.lead}</p>
          <p>{t.story.body}</p>
          <a className="text-link" href="/our-story">{t.story.journey} <span>→</span></a>
        </div>
      </section>

      <section className="process-section" id="process">
        <div className="process-heading">
          <p className="eyebrow light">{t.process.eyebrow}</p>
          <h2>{t.process.title}</h2>
          <p>{t.process.body}</p>
        </div>
        <div className="process-grid">
          {t.process.steps.map((step, index) => (
            <article key={step.title}>
              <span>0{index + 1}</span><div className="process-icon">{processIcons[index]}</div><h3>{step.title}</h3><p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="collection-feature section" id="collection">
        <div className="collection-photo" role="img" aria-label={t.collection.imageLabel} />
        <div className="collection-copy">
          <p className="eyebrow">{t.collection.eyebrow}</p>
          <h2>{t.collection.title[0]}<br />{t.collection.title[1]}</h2>
          <p>{t.collection.body}</p>
          <ul>
            {t.collection.rows.map((row) => <li key={row.label}><span>{row.label}</span><strong>{row.value}</strong></li>)}
          </ul>
          <a className="button button-dark" href={shopUrl}>{t.collection.choose} <span>↑</span></a>
        </div>
      </section>

      <section className="wholesale-section" id="wholesale">
        {isMobile ? (
          <>
            <div className="wholesale-intro">
              <p className="eyebrow light">{t.wholesale.eyebrow}</p>
              <h2>{t.wholesale.title}</h2>
              <p>{t.wholesale.body}</p>
              <div className="wholesale-benefits">
                {t.wholesale.benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
              </div>
              <button
                ref={wholesaleButtonRef}
                className="button button-gold wholesale-mobile-button"
                type="button"
                onClick={() => setWholesaleModalOpen(true)}
              >
                START A WHOLESALE INQUIRY <span>→</span>
              </button>
            </div>
            {wholesaleModalOpen && (
              <div className="wholesale-modal-backdrop" aria-modal="true" role="dialog" aria-labelledby="wholesale-mobile-title">
                <div className="wholesale-modal-content">
                  <div className="wholesale-modal-header">
                    <button
                      ref={wholesaleCloseRef}
                      type="button"
                      className="wholesale-close"
                      onClick={() => setWholesaleModalOpen(false)}
                      aria-label="Close wholesale inquiry"
                    >
                      ×
                    </button>
                    <h3 id="wholesale-mobile-title">Wholesale Inquiry.</h3>
                  </div>
                  <form className="wholesale-form wholesale-modal-form" onSubmit={(event) => { event.preventDefault(); setWholesaleSent(true); }}>
                    {wholesaleSent ? (
                      <div className="form-success" role="status">
                        <span>✓</span>
                        <h3>{t.wholesale.successTitle}</h3>
                        <p>{t.wholesale.successBody}</p>
                        <button type="button" className="text-link" onClick={() => setWholesaleSent(false)}>{t.wholesale.sendAnother}</button>
                      </div>
                    ) : (
                      <>
                        <label>{t.wholesale.businessName}<input name="business" required placeholder={t.wholesale.businessPlaceholder} /></label>
                        <label>{t.wholesale.email}<input name="email" type="email" required placeholder={t.wholesale.emailPlaceholder} /></label>
                        <label>{t.wholesale.type}
                          <select name="type" required defaultValue="">
                            <option value="" disabled>{t.wholesale.selectOne}</option>
                            {t.wholesale.options.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        </label>
                        <label>{t.wholesale.needs}<textarea name="message" rows={3} placeholder={t.wholesale.needsPlaceholder} /></label>
                        <button className="button button-gold" type="submit">{t.wholesale.submit} <span>→</span></button>
                      </>
                    )}
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="wholesale-intro">
              <p className="eyebrow light">{t.wholesale.eyebrow}</p>
              <h2>{t.wholesale.title}</h2>
              <p>{t.wholesale.body}</p>
              <div className="wholesale-benefits">
                {t.wholesale.benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
              </div>
            </div>
            <form className="wholesale-form" onSubmit={(event) => { event.preventDefault(); setWholesaleSent(true); }}>
              {wholesaleSent ? (
                <div className="form-success" role="status">
                  <span>✓</span>
                  <h3>{t.wholesale.successTitle}</h3>
                  <p>{t.wholesale.successBody}</p>
                  <button type="button" className="text-link" onClick={() => setWholesaleSent(false)}>{t.wholesale.sendAnother}</button>
                </div>
              ) : (
                <>
                  <div className="form-heading"><span>{t.wholesale.formTitle}</span><small>{t.wholesale.required}</small></div>
                  <label>{t.wholesale.businessName}<input name="business" required placeholder={t.wholesale.businessPlaceholder} /></label>
                  <label>{t.wholesale.email}<input name="email" type="email" required placeholder={t.wholesale.emailPlaceholder} /></label>
                  <label>{t.wholesale.type}
                    <select name="type" required defaultValue="">
                      <option value="" disabled>{t.wholesale.selectOne}</option>
                      {t.wholesale.options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>{t.wholesale.needs}<textarea name="message" rows={3} placeholder={t.wholesale.needsPlaceholder} /></label>
                  <button className="button button-gold" type="submit">{t.wholesale.submit} <span>→</span></button>
                </>
              )}
            </form>
          </>
        )}
      </section>

      <section className="newsletter" id="newsletter">
        <div><p className="eyebrow light">{t.newsletter.eyebrow}</p><h2>{t.newsletter.title}</h2></div>
        {emailJoined ? (
          <p className="newsletter-success" role="status">{t.newsletter.success}</p>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setEmailJoined(true); }}>
            <label className="sr-only" htmlFor="newsletter-email">{t.newsletter.emailLabel}</label>
            <input id="newsletter-email" type="email" required placeholder={t.newsletter.placeholder} />
            <button type="submit" aria-label={t.newsletter.joinLabel}>→</button>
          </form>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <a href="#top" aria-label={t.nav.home}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5L12 4l9 7.5v7a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1v-7Z" />
          </svg>
          <span>{t.nav.home}</span>
        </a>
        <a href="/our-story" aria-label={t.nav.story}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M8 7h8M8 12h8M8 17h5" />
          </svg>
          <span>{t.nav.story}</span>
        </a>
        <a href="#shop" aria-label={t.nav.coffee}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" />
            <path d="M6 12h12" />
            <path d="M8 4h1.5a1 1 0 0 1 0 2H8" />
            <path d="M12 4h1.5a1 1 0 0 1 0 2H12" />
          </svg>
          <span>{t.nav.coffee}</span>
        </a>
        <a href="#newsletter" aria-label={t.nav.contact}>
          <svg className="bottom-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            <path d="m4 6 8 7 8-7" />
          </svg>
          <span>{t.nav.contact}</span>
        </a>
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
          <a className="wordmark footer-wordmark" href="#top" aria-label={t.homeLabel}>
            <Image className="brand-logo footer-logo" src="/images/marianas-coffee-logo.png" width={126} height={123} alt={t.brandAlt} />
          </a>
          <p>{t.footer.body[0]}<br />{t.footer.body[1]}</p>
        </div>
        <div className="footer-links"><strong>{t.footer.explore}</strong>{t.footer.links.map((label, index) => <a key={label} href={[shopUrl, "/our-story", "#process", "#wholesale"][index]}>{label}</a>)}</div>
        <div className="footer-links"><strong>{t.footer.contact}</strong><span>{t.footer.location}</span><a href="tel:+16702341000">+1 670 234 1000</a><a href="tel:+16703229554">+1 670 322 9554</a></div>
        <div className="footer-bottom"><span>{t.footer.copyright}</span><span>Earth&apos;s Finest Coffee®</span><span>Saipan · MP 96950</span></div>
      </footer>

    </main>
  );
}
