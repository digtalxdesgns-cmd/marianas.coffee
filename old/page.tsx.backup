"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { localeOptions, translations, type Locale } from "./translations";

const processIcons = ["≈", "◌", "☼"];
const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.marianascoffee.com").replace(/\/$/, "");

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [wholesaleSent, setWholesaleSent] = useState(false);
  const [emailJoined, setEmailJoined] = useState(false);

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
        <a className="announcement-extra announcement-link" href="#film">{t.watchStory} <span>→</span></a>
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label={t.homeLabel}>
          <Image className="brand-logo header-logo" src="/images/marianas-coffee-logo.png" width={72} height={70} alt={t.brandAlt} priority />
        </a>

        <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label={t.toggleMenu}>
          <a href={shopUrl} onClick={() => setMenuOpen(false)}>{t.nav.shop}</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>{t.nav.story}</a>
          <a href="#process" onClick={() => setMenuOpen(false)}>{t.nav.coffee}</a>
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
            <a className="text-link light-link" href="#story">{t.discoverStory} <span>↘</span></a>
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
      </section>

      <section className="shop-preview section" id="shop">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">{t.shop.eyebrow}</p><h2>{t.shop.title}</h2></div>
          <a className="text-link" href={shopUrl}>{t.shop.all} <span>→</span></a>
        </div>

        <div className="product-grid">
          {t.shop.products.map((coffee, index) => (
            <article className="product-card" key={coffee.name}>
              <div className={`product-visual ${coffee.tone}`}>
                {index === 1 && <span className="badge">{t.shop.bestseller}</span>}
                <div className="coffee-bag">
                  <Image className="bag-logo" src="/images/marianas-coffee-logo.png" width={76} height={76} alt="" />
                  <strong>MARIANAS<br />COFFEE</strong>
                  <small>{t.shop.bagClaim[0]}<br />{t.shop.bagClaim[1]}</small>
                </div>
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
          ))}
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
          <a className="text-link" href="#process">{t.story.journey} <span>→</span></a>
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

      <section className="collection-feature section">
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

      <footer>
        <div className="footer-brand">
          <a className="wordmark footer-wordmark" href="#top" aria-label={t.homeLabel}>
            <Image className="brand-logo footer-logo" src="/images/marianas-coffee-logo.png" width={126} height={123} alt={t.brandAlt} />
          </a>
          <p>{t.footer.body[0]}<br />{t.footer.body[1]}</p>
        </div>
        <div className="footer-links"><strong>{t.footer.explore}</strong>{t.footer.links.map((label, index) => <a key={label} href={[shopUrl, "#story", "#process", "#wholesale"][index]}>{label}</a>)}</div>
        <div className="footer-links"><strong>{t.footer.contact}</strong><span>{t.footer.location}</span><a href="tel:+16702341000">+1 670 234 1000</a><a href="tel:+16703229554">+1 670 322 9554</a></div>
        <div className="footer-bottom"><span>{t.footer.copyright}</span><span>Earth&apos;s Finest Coffee®</span><span>Saipan · MP 96950</span></div>
      </footer>

    </main>
  );
}
