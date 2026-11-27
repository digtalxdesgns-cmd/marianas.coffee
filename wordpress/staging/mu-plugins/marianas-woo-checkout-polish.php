<?php
/**
 * Plugin Name: Marianas Coffee Checkout Polish (STAGING ONLY)
 * Description: Staging-only, checkout-scoped visual and multilingual polish for hardcoded checkout theme snippets, order-summary table overflow, and the header language selector.
 * Version: 0.1.1
 *
 * SECURITY & SAFETY NOTES:
 * - Strict staging hostname allowlist: activates ONLY on MARIANAS_STAGING_HOST (default: regionaltest.shop.marianascoffee.com).
 * - Exits immediately with zero hooks registered on production (shop.marianascoffee.com) or any other host.
 * - Scoped strictly to WooCommerce checkout requests (is_checkout()) — never alters WP-Admin, Store API, cart handoff, payment gateways, emails, or unrelated pages.
 * - Reads customer-facing translations from the synchronized marianas-i18n/translations.json dictionary.
 * - Single-file rollback: delete this file and purge LiteSpeed Cache.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MARIANAS_STAGING_HOST' ) ) {
	define( 'MARIANAS_STAGING_HOST', 'regionaltest.shop.marianascoffee.com' );
}

/**
 * Returns the normalized current HTTP host without port, or empty string if unavailable.
 */
function marianas_checkout_polish_current_host() {
	if ( empty( $_SERVER['HTTP_HOST'] ) || ! is_string( $_SERVER['HTTP_HOST'] ) ) {
		return '';
	}
	$host = strtolower( trim( wp_unslash( $_SERVER['HTTP_HOST'] ) ) );
	$host = preg_replace( '/:\d+$/', '', $host );
	return is_string( $host ) ? $host : '';
}

/**
 * Strict staging hostname allowlist check. Never activates on production.
 */
function marianas_checkout_polish_is_staging_host() {
	$expected = strtolower( trim( (string) MARIANAS_STAGING_HOST ) );
	$current  = marianas_checkout_polish_current_host();
	return '' !== $expected && '' !== $current && hash_equals( $expected, $current );
}

if ( ! marianas_checkout_polish_is_staging_host() ) {
	return;
}

/**
 * Resolves the active validated storefront language (en|zh|ko|ja).
 */
function marianas_checkout_polish_resolve_lang() {
	$allowed = array( 'en', 'zh', 'ko', 'ja' );

	if ( function_exists( 'marianas_resolve_checkout_lang' ) ) {
		$resolved = marianas_resolve_checkout_lang();
		if ( is_string( $resolved ) && in_array( $resolved, $allowed, true ) ) {
			return $resolved;
		}
	}

	if ( isset( $_GET['lang'] ) && is_string( $_GET['lang'] ) ) {
		$query_lang = strtolower( trim( sanitize_key( wp_unslash( $_GET['lang'] ) ) ) );
		if ( in_array( $query_lang, $allowed, true ) ) {
			return $query_lang;
		}
	}

	if ( isset( $_COOKIE['mc_checkout_lang'] ) && is_string( $_COOKIE['mc_checkout_lang'] ) ) {
		$cookie_lang = strtolower( trim( sanitize_key( wp_unslash( $_COOKIE['mc_checkout_lang'] ) ) ) );
		if ( in_array( $cookie_lang, $allowed, true ) ) {
			return $cookie_lang;
		}
	}

	return 'en';
}

/**
 * Returns true only on front-end WooCommerce checkout pages (never WP-Admin or unrelated pages).
 */
function marianas_checkout_polish_is_checkout_request() {
	if ( is_admin() && ! wp_doing_ajax() ) {
		return false;
	}
	return function_exists( 'is_checkout' ) && is_checkout();
}

/**
 * Loads the synchronized WooCommerce translation dictionary indexed by entry key.
 * Returns [ key => [ 'en' => source, 'zh' => ..., 'ko' => ..., 'ja' => ... ] ].
 */
function marianas_checkout_polish_load_keyed_dictionary( $custom_path = null ) {
	static $cache = array();

	$path = is_string( $custom_path ) && '' !== $custom_path
		? $custom_path
		: __DIR__ . '/marianas-i18n/translations.json';

	if ( isset( $cache[ $path ] ) ) {
		return $cache[ $path ];
	}

	$index = array();

	if ( ! is_file( $path ) ) {
		$cache[ $path ] = $index;
		return $index;
	}

	$raw = @file_get_contents( $path );
	if ( ! is_string( $raw ) || '' === $raw ) {
		$cache[ $path ] = $index;
		return $index;
	}

	$decoded = json_decode( $raw, true );
	if ( ! is_array( $decoded ) || empty( $decoded['woocommerce']['categories'] ) || ! is_array( $decoded['woocommerce']['categories'] ) ) {
		$cache[ $path ] = $index;
		return $index;
	}

	foreach ( $decoded['woocommerce']['categories'] as $entries ) {
		if ( ! is_array( $entries ) ) {
			continue;
		}
		foreach ( $entries as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['key'] ) || empty( $entry['source'] ) ) {
				continue;
			}
			$key = (string) $entry['key'];
			$src = (string) $entry['source'];

			$row = array( 'en' => $src );
			foreach ( array( 'zh', 'ko', 'ja' ) as $lang ) {
				$candidate    = isset( $entry[ $lang ] ) && is_string( $entry[ $lang ] ) ? trim( $entry[ $lang ] ) : '';
				$row[ $lang ] = '' !== $candidate ? $candidate : $src;
			}
			$index[ $key ] = $row;
		}
	}

	$cache[ $path ] = $index;
	return $index;
}

/**
 * Builds the plain-text checkout polish payload for a validated language.
 */
function marianas_checkout_polish_build_payload( $lang, $custom_path = null ) {
	$allowed = array( 'en', 'zh', 'ko', 'ja' );
	$code    = in_array( $lang, $allowed, true ) ? $lang : 'en';
	$dict    = marianas_checkout_polish_load_keyed_dictionary( $custom_path );

	$pick = function ( $key, $fallback ) use ( $dict, $code ) {
		if ( isset( $dict[ $key ][ $code ] ) && '' !== $dict[ $key ][ $code ] ) {
			return $dict[ $key ][ $code ];
		}
		return $fallback;
	};

	return array(
		'lang'    => $code,
		'labels'  => array(
			'en' => 'English',
			'zh' => '中文',
			'ko' => '한국어',
			'ja' => '日本語',
		),
		'strings' => array(
			'stepCart'          => $pick( 'cart.title', 'Cart' ),
			'stepCheckout'      => $pick( 'checkout.title', 'Checkout' ),
			'stepConfirmation'  => $pick( 'checkout.step_confirmation', 'Confirmation' ),
			'progressAria'      => $pick( 'checkout.progress_aria', 'Checkout progress' ),
			'secureCheckout'    => $pick( 'checkout.secure_eyebrow', 'Secure checkout' ),
			'heroTitle'         => $pick( 'checkout.hero_title', 'Complete your order.' ),
			'heroLead'          => $pick( 'checkout.hero_lead', 'Freshly roasted in Saipan and carefully packed for its journey to you.' ),
			'orderSummary'      => $pick( 'checkout.order_summary', 'Order summary' ),
			'trustShippingNote' => $pick( 'checkout.trust_shipping_note', 'Shipping shown before payment' ),
			'selectLanguage'    => $pick( 'checkout.select_language', 'Select language' ),
		),
	);
}

/**
 * Returns the scoped checkout-only CSS rules fixing:
 * 1. Order-summary table width and price alignment across 320px-1440px.
 * 2. CJK heading line-height and letter-spacing on checkout intro and section headings.
 * 3. Header language-selector single chevron (removing stray wrapped Chromium arrow).
 */
function marianas_checkout_polish_get_css() {
	return <<<'CSS'
/* Marianas Coffee Staging Checkout Polish — scoped strictly to body.woocommerce-checkout */

/* 1. Order-summary card & table width / price alignment (320px-1440px) */
html body.woocommerce-checkout form.checkout > .mc-checkout-summary,
html body.woocommerce-checkout #order_review {
	box-sizing: border-box !important;
	max-width: 100% !important;
	overflow-x: clip !important;
}

html body.woocommerce-checkout table.woocommerce-checkout-review-order-table {
	table-layout: fixed !important;
	width: 100% !important;
	max-width: 100% !important;
	box-sizing: border-box !important;
}

html body.woocommerce-checkout table.woocommerce-checkout-review-order-table td.product-name {
	width: 64% !important;
	padding-right: 12px !important;
	overflow-wrap: break-word !important;
	word-break: break-word !important;
}

html body.woocommerce-checkout table.woocommerce-checkout-review-order-table td.product-total {
	width: 36% !important;
	text-align: right !important;
	white-space: nowrap !important;
}

html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot th {
	width: 38% !important;
	padding-right: 12px !important;
	overflow-wrap: break-word !important;
}

html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot td,
html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot tr.shipping td {
	width: 62% !important;
	text-align: right !important;
	white-space: normal !important;
	overflow-wrap: anywhere !important;
	word-break: break-word !important;
}

html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot tr.cart-subtotal td,
html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot tr.order-total td,
html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table .woocommerce-Price-amount {
	white-space: nowrap !important;
}

@media (max-width: 430px) {
	html body.woocommerce-checkout table.woocommerce-checkout-review-order-table td.product-name {
		width: 60% !important;
	}

	html body.woocommerce-checkout table.woocommerce-checkout-review-order-table td.product-total {
		width: 40% !important;
	}

	html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot th {
		width: 34% !important;
	}

	html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot td,
	html body.woocommerce-checkout #order_review table.woocommerce-checkout-review-order-table tfoot tr.shipping td {
		width: 66% !important;
	}
}

/* 2. CJK heading typography protection on checkout */
html[lang="zh-CN"] body.woocommerce-checkout .mc-checkout-intro h1,
html[lang="ko-KR"] body.woocommerce-checkout .mc-checkout-intro h1,
html[lang="ja-JP"] body.woocommerce-checkout .mc-checkout-intro h1 {
	line-height: 1.18 !important;
	letter-spacing: -0.02em !important;
}

html[lang="zh-CN"] body.woocommerce-checkout #order_review_heading,
html[lang="ko-KR"] body.woocommerce-checkout #order_review_heading,
html[lang="ja-JP"] body.woocommerce-checkout #order_review_heading,
html[lang="zh-CN"] body.woocommerce-checkout #customer_details h3,
html[lang="ko-KR"] body.woocommerce-checkout #customer_details h3,
html[lang="ja-JP"] body.woocommerce-checkout #customer_details h3 {
	line-height: 1.2 !important;
	letter-spacing: 0 !important;
}

html[lang="zh-CN"] body.woocommerce-checkout .mc-checkout-progress,
html[lang="ko-KR"] body.woocommerce-checkout .mc-checkout-progress,
html[lang="ja-JP"] body.woocommerce-checkout .mc-checkout-progress,
html[lang="zh-CN"] body.woocommerce-checkout .mc-checkout-eyebrow,
html[lang="ko-KR"] body.woocommerce-checkout .mc-checkout-eyebrow,
html[lang="ja-JP"] body.woocommerce-checkout .mc-checkout-eyebrow {
	letter-spacing: 0.08em !important;
}

/* 3. Header language selector: single chevron, zero stray wrapped dropdown arrow */
html body.woocommerce-checkout #mc-custom-header .mc-language-control {
	position: relative !important;
	display: inline-flex !important;
	align-items: center !important;
	width: 90px !important;
	height: 36px !important;
	border: 1px solid var(--mc-border, #c5cdc8) !important;
	border-radius: 20px !important;
	background: transparent !important;
	overflow: hidden !important;
}

html body.woocommerce-checkout #mc-custom-header .mc-language-control:has(select:focus-visible) {
	border-color: var(--mc-checkout-red, #8f120d) !important;
	box-shadow: 0 0 0 2px rgba(143, 18, 13, 0.16) !important;
}

html body.woocommerce-checkout #mc-custom-header .mc-language-control .mc-language-display {
	display: block !important;
	width: 100% !important;
	padding: 0 24px 0 12px !important;
	color: var(--mc-navigation-text, #4a190f) !important;
	font: 500 10px/1 Arial, Helvetica, sans-serif !important;
	white-space: nowrap !important;
	overflow: hidden !important;
	text-overflow: ellipsis !important;
	pointer-events: none !important;
}

html body.woocommerce-checkout #mc-custom-header .mc-language-control select#mc-language-select {
	appearance: none !important;
	-webkit-appearance: none !important;
	-moz-appearance: none !important;
	background-image: none !important;
	overflow: hidden !important;
}

html body.woocommerce-checkout #mc-custom-header .mc-language-control select#mc-language-select::picker-icon {
	display: none !important;
}

html body.woocommerce-checkout #mc-custom-header .mc-language-control.mc-lang-enhanced select#mc-language-select {
	position: absolute !important;
	inset: 0 !important;
	width: 100% !important;
	min-width: 0 !important;
	max-width: none !important;
	height: 100% !important;
	min-height: 0 !important;
	max-height: none !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	opacity: 0 !important;
	cursor: pointer !important;
}

@media (max-width: 700px) {
	html body.woocommerce-checkout #mc-custom-header .mc-language-control {
		width: 72px !important;
		height: 33px !important;
		border-radius: 18px !important;
	}

	html body.woocommerce-checkout #mc-custom-header .mc-language-control .mc-language-display {
		padding: 0 21px 0 9px !important;
	}
}
CSS;
}

/**
 * Filters the WooCommerce checkout privacy policy notice text using the approved
 * dictionary entry (preserving WooCommerce's [privacy_policy] link placeholder).
 */
function marianas_checkout_polish_privacy_policy_text( $text, $type ) {
	if ( 'checkout' !== $type || ! marianas_checkout_polish_is_checkout_request() ) {
		return $text;
	}

	$lang = marianas_checkout_polish_resolve_lang();
	if ( 'en' === $lang ) {
		return $text;
	}

	$dict = marianas_checkout_polish_load_keyed_dictionary();
	if ( empty( $dict['payment.privacy_notice'][ $lang ] ) ) {
		return $text;
	}

	$template = $dict['payment.privacy_notice'][ $lang ];
	if ( false === strpos( $template, '%s' ) ) {
		return $text;
	}

	return str_replace( '%s', '[privacy_policy]', $template );
}
add_filter( 'woocommerce_get_privacy_policy_text', 'marianas_checkout_polish_privacy_policy_text', 20, 2 );

/**
 * Outputs scoped checkout-only CSS after theme/snippet styles.
 */
function marianas_checkout_polish_print_css() {
	if ( ! marianas_checkout_polish_is_checkout_request() ) {
		return;
	}

	echo "\n<style id=\"mc-checkout-polish-css\">\n" . marianas_checkout_polish_get_css() . "\n</style>\n";
}
add_action( 'wp_head', 'marianas_checkout_polish_print_css', PHP_INT_MAX );

/**
 * Outputs scoped checkout-only JS after mc-luxury-checkout-js and mc-vercel-matched-header-js.
 * Translates hardcoded checkout snippets, preserves Order summary localization across AJAX
 * refreshes, renders the single-chevron language overlay, and keeps language switching on
 * the current staging checkout host.
 */
function marianas_checkout_polish_print_js() {
	if ( ! marianas_checkout_polish_is_checkout_request() ) {
		return;
	}

	$lang    = marianas_checkout_polish_resolve_lang();
	$payload = marianas_checkout_polish_build_payload( $lang );
	$json    = function_exists( 'wp_json_encode' )
		? wp_json_encode( $payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT )
		: json_encode( $payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );

	if ( ! is_string( $json ) || '' === $json ) {
		return;
	}

	echo "\n<script id=\"mc-checkout-polish-js\">\n";
	echo "(function () {\n";
	echo "\t'use strict';\n";
	echo "\tvar cfg = " . $json . ";\n";
	echo <<<'JS'
	if (!cfg || !cfg.strings) return;

	var SUPPORTED_LANGS = ['en', 'zh', 'ko', 'ja'];
	var activeLang = SUPPORTED_LANGS.indexOf(cfg.lang) !== -1 ? cfg.lang : 'en';

	function setTextIfDifferent(el, value) {
		if (!el || typeof value !== 'string' || !value) return;
		if (el.textContent !== value) {
			el.textContent = value;
		}
	}

	function buildStagingLangUrl(langCode) {
		var code = SUPPORTED_LANGS.indexOf(langCode) !== -1 ? langCode : 'en';
		try {
			var url = new URL(window.location.href);
			// Strip mc_cart so switching checkout language preserves the active cart without re-running handoff.
			url.searchParams.delete('mc_cart');
			url.searchParams.set('lang', code);
			return url.toString();
		} catch (e) {
			return window.location.pathname + '?lang=' + encodeURIComponent(code);
		}
	}

	function applyCheckoutTranslations() {
		var s = cfg.strings;

		var progress = document.querySelector('.mc-checkout-progress');
		if (progress) {
			progress.setAttribute('aria-label', s.progressAria);
			var steps = progress.querySelectorAll('span');
			if (steps.length >= 3) {
				setTextIfDifferent(steps[0], s.stepCart);
				setTextIfDifferent(steps[1], s.stepCheckout);
				setTextIfDifferent(steps[2], s.stepConfirmation);
			}
		}

		setTextIfDifferent(document.querySelector('.mc-checkout-eyebrow'), s.secureCheckout);
		setTextIfDifferent(document.getElementById('mc-checkout-title'), s.heroTitle);
		setTextIfDifferent(document.querySelector('.mc-checkout-lead'), s.heroLead);
		setTextIfDifferent(document.getElementById('order_review_heading'), s.orderSummary);

		var trust = document.querySelector('.mc-checkout-trust');
		if (trust) {
			var trustSpans = trust.querySelectorAll('span');
			if (trustSpans.length >= 2) {
				setTextIfDifferent(trustSpans[0], s.secureCheckout);
				setTextIfDifferent(trustSpans[1], s.trustShippingNote);
			}
		}
	}

	function enhanceHeaderLanguageSelector() {
		var select = document.getElementById('mc-language-select');
		if (!select) return;

		var control = select.closest('.mc-language-control');
		var labels = cfg.labels || { en: 'English', zh: '中文', ko: '한국어', ja: '日本語' };

		select.setAttribute('aria-label', cfg.strings.selectLanguage);
		if (control) {
			var srText = control.querySelector('.mc-screen-reader-text');
			setTextIfDifferent(srText, cfg.strings.selectLanguage);
		}

		// Rewrite options strictly to same-origin staging checkout URLs with ?lang=en|zh|ko|ja.
		var urlByLang = {};
		for (var i = 0; i < SUPPORTED_LANGS.length; i++) {
			urlByLang[SUPPORTED_LANGS[i]] = buildStagingLangUrl(SUPPORTED_LANGS[i]);
		}

		var options = select.options;
		if (options && options.length === SUPPORTED_LANGS.length) {
			for (var j = 0; j < SUPPORTED_LANGS.length; j++) {
				var code = SUPPORTED_LANGS[j];
				options[j].value = urlByLang[code];
				options[j].setAttribute('data-mc-lang', code);
				options[j].textContent = labels[code] || options[j].textContent;
				options[j].selected = (code === activeLang);
			}
		} else {
			while (select.firstChild) {
				select.removeChild(select.firstChild);
			}
			for (var k = 0; k < SUPPORTED_LANGS.length; k++) {
				var c = SUPPORTED_LANGS[k];
				var opt = document.createElement('option');
				opt.value = urlByLang[c];
				opt.setAttribute('data-mc-lang', c);
				opt.textContent = labels[c] || c;
				opt.selected = (c === activeLang);
				select.appendChild(opt);
			}
		}

		select.value = urlByLang[activeLang];

		// Render a single clean visible label beneath the transparent native <select> so Chromium cannot paint a stray arrow.
		if (control) {
			var display = control.querySelector('.mc-language-display');
			if (!display) {
				display = document.createElement('span');
				display.className = 'mc-language-display';
				display.setAttribute('aria-hidden', 'true');
				control.insertBefore(display, select);
			}
			setTextIfDifferent(display, labels[activeLang] || 'English');
			control.classList.add('mc-lang-enhanced');

			// Capture-phase listener guarantees language switching stays on the current staging origin.
			if (!control.dataset.mcCheckoutLangBound) {
				control.dataset.mcCheckoutLangBound = 'true';
				control.addEventListener('change', function (event) {
					if (event.target !== select) return;
					event.stopImmediatePropagation();
					var selectedOpt = select.options[select.selectedIndex];
					var chosenCode = selectedOpt ? selectedOpt.getAttribute('data-mc-lang') : '';
					if (SUPPORTED_LANGS.indexOf(chosenCode) === -1) return;
					setTextIfDifferent(display, labels[chosenCode] || 'English');
					var dest = buildStagingLangUrl(chosenCode);
					try {
						var parsed = new URL(dest, window.location.origin);
						if (parsed.origin === window.location.origin) {
							window.location.assign(parsed.toString());
						}
					} catch (e) {
						window.location.assign(dest);
					}
				}, true);
			}
		}
	}

	function observeOrderSummaryOverwrites() {
		if (typeof MutationObserver === 'undefined') return;
		var form = document.querySelector('form.checkout');
		if (!form || form.dataset.mcPolishObserved) return;
		form.dataset.mcPolishObserved = 'true';

		var observer = new MutationObserver(function () {
			applyCheckoutTranslations();
		});
		observer.observe(form, { childList: true, subtree: true, characterData: true });
	}

	function runPolish() {
		applyCheckoutTranslations();
		enhanceHeaderLanguageSelector();
		observeOrderSummaryOverwrites();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', runPolish);
	} else {
		runPolish();
	}

	if (window.jQuery) {
		window.jQuery(document.body).on('updated_checkout', applyCheckoutTranslations);
	}
	// Run shortly after mc-luxury-checkout-js's 250ms timeout.
	window.setTimeout(applyCheckoutTranslations, 300);
	window.setTimeout(applyCheckoutTranslations, 600);
})();
JS;
	echo "\n</script>\n";
}
add_action( 'wp_footer', 'marianas_checkout_polish_print_js', 999 );
