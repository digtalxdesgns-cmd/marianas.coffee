<?php
/**
 * Plugin Name: Marianas Coffee Multilingual Checkout (STAGING REVIEW)
 * Description: Preserves the storefront language (en, zh, ko, ja) across WooCommerce checkout and customer emails using version-controlled custom translations with safe fallback.
 * Version: 0.2.0
 *
 * SECURITY & DESIGN NOTES:
 * - Strict 4-language allowlist only: en -> en_US, zh -> zh_CN, ko -> ko_KR, ja -> ja_JP.
 * - Loads custom plain-text translations from marianas-i18n/translations.json (draft pending owner approval).
 * - Preserves printf placeholder parity (%s, %d) so dynamic WooCommerce sprintf() calls never fail.
 * - Falls back cleanly to installed WordPress/WooCommerce language packs or default English for any uncovered string.
 * - Never alters WP-Admin non-AJAX locales, product prices, cart totals, shipping calculations, taxes, or payment gateways.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MARIANAS_LANG_COOKIE_NAME = 'mc_checkout_lang';
const MARIANAS_LANG_COOKIE_TTL  = 604800; // 7 days.

/**
 * Tracks active customer email locale while WooCommerce renders a customer notification email.
 *
 * @var string
 */
$GLOBALS['marianas_active_email_lang'] = '';

/**
 * Returns the strict map from storefront locale codes to WordPress locale codes.
 */
function marianas_supported_checkout_locales() {
	return array(
		'en' => 'en_US',
		'zh' => 'zh_CN',
		'ko' => 'ko_KR',
		'ja' => 'ja_JP',
	);
}

/**
 * Returns text domains eligible for Marianas Coffee customer-facing dictionary overrides.
 */
function marianas_custom_translation_domains() {
	return array( 'woocommerce', 'default', 'marianas-coffee' );
}

/**
 * Extracts printf placeholders (%s, %d, %1$s) to ensure translated format strings
 * match the exact argument signature of the English source string.
 */
function marianas_extract_printf_placeholders( $text ) {
	if ( ! is_string( $text ) ) {
		return array();
	}
	if ( preg_match_all( '/%(?:\d+\$)?[sd]/', $text, $matches ) ) {
		return $matches[0];
	}
	return array();
}

/**
 * Loads and indexes the version-controlled WooCommerce translation dictionary once per request.
 * Returns [ 'zh' => [ source => translation ], 'ko' => [...], 'ja' => [...] ].
 * Never throws; returns empty map if file is absent or unreadable so fallback always works.
 */
function marianas_load_custom_woo_dictionary( $custom_path = null ) {
	static $cache = array();

	$path = is_string( $custom_path ) && '' !== $custom_path
		? $custom_path
		: __DIR__ . '/marianas-i18n/translations.json';

	if ( isset( $cache[ $path ] ) ) {
		return $cache[ $path ];
	}

	$index = array(
		'zh' => array(),
		'ko' => array(),
		'ja' => array(),
	);

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
			if ( ! is_array( $entry ) || empty( $entry['source'] ) || ! is_string( $entry['source'] ) ) {
				continue;
			}
			$source       = $entry['source'];
			$source_specs = marianas_extract_printf_placeholders( $source );

			foreach ( array( 'zh', 'ko', 'ja' ) as $lang ) {
				if ( empty( $entry[ $lang ] ) || ! is_string( $entry[ $lang ] ) ) {
					continue;
				}
				$candidate = trim( $entry[ $lang ] );
				if ( '' === $candidate ) {
					continue;
				}
				// Guard against malformed format strings breaking dynamic WooCommerce sprintf() calls.
				if ( marianas_extract_printf_placeholders( $candidate ) !== $source_specs ) {
					continue;
				}
				$index[ $lang ][ $source ] = $candidate;
			}
		}
	}

	$cache[ $path ] = $index;
	return $index;
}

/**
 * Resolves the requested storefront language (en|zh|ko|ja) from query string or cookie.
 */
function marianas_resolve_checkout_lang() {
	$supported = marianas_supported_checkout_locales();

	if ( isset( $_GET['lang'] ) && is_string( $_GET['lang'] ) ) {
		$query_lang = strtolower( trim( sanitize_key( wp_unslash( $_GET['lang'] ) ) ) );
		if ( isset( $supported[ $query_lang ] ) ) {
			return $query_lang;
		}
	}

	if ( isset( $_COOKIE[ MARIANAS_LANG_COOKIE_NAME ] ) && is_string( $_COOKIE[ MARIANAS_LANG_COOKIE_NAME ] ) ) {
		$cookie_lang = strtolower( trim( sanitize_key( wp_unslash( $_COOKIE[ MARIANAS_LANG_COOKIE_NAME ] ) ) ) );
		if ( isset( $supported[ $cookie_lang ] ) ) {
			return $cookie_lang;
		}
	}

	return '';
}

/**
 * Returns the active custom translation language for the current context
 * (customer email override takes precedence while rendering a customer email).
 */
function marianas_active_translation_lang() {
	if ( ! empty( $GLOBALS['marianas_active_email_lang'] ) && is_string( $GLOBALS['marianas_active_email_lang'] ) ) {
		return $GLOBALS['marianas_active_email_lang'];
	}
	if ( is_admin() && ! wp_doing_ajax() ) {
		return '';
	}
	return marianas_resolve_checkout_lang();
}

/**
 * Translates a single WordPress/WooCommerce string using the custom dictionary,
 * falling back cleanly to the existing WordPress translation when uncovered.
 */
function marianas_translate_custom_gettext( $translated, $text, $domain ) {
	if ( ! is_string( $text ) || '' === $text ) {
		return $translated;
	}
	if ( ! in_array( (string) $domain, marianas_custom_translation_domains(), true ) ) {
		return $translated;
	}

	$lang = marianas_active_translation_lang();
	if ( '' === $lang || 'en' === $lang ) {
		return $translated;
	}

	$dictionary = marianas_load_custom_woo_dictionary();
	if ( isset( $dictionary[ $lang ][ $text ] ) ) {
		return $dictionary[ $lang ][ $text ];
	}

	return $translated;
}
add_filter( 'gettext', 'marianas_translate_custom_gettext', 20, 3 );

/**
 * Context-aware gettext hook so strings translated with _x() also resolve cleanly.
 */
function marianas_translate_custom_gettext_with_context( $translated, $text, $context, $domain ) {
	return marianas_translate_custom_gettext( $translated, $text, $domain );
}
add_filter( 'gettext_with_context', 'marianas_translate_custom_gettext_with_context', 20, 4 );

/**
 * Persists a validated ?lang= query parameter in a SameSite=Lax cookie.
 */
function marianas_persist_checkout_lang_cookie() {
	if ( is_admin() || headers_sent() ) {
		return;
	}

	$supported = marianas_supported_checkout_locales();
	if ( ! isset( $_GET['lang'] ) || ! is_string( $_GET['lang'] ) ) {
		return;
	}

	$lang = strtolower( trim( sanitize_key( wp_unslash( $_GET['lang'] ) ) ) );
	if ( ! isset( $supported[ $lang ] ) ) {
		return;
	}

	setcookie(
		MARIANAS_LANG_COOKIE_NAME,
		$lang,
		array(
			'expires'  => time() + MARIANAS_LANG_COOKIE_TTL,
			'path'     => defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/',
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);
	$_COOKIE[ MARIANAS_LANG_COOKIE_NAME ] = $lang;

	if ( function_exists( 'nocache_headers' ) ) {
		nocache_headers();
	}
}
add_action( 'init', 'marianas_persist_checkout_lang_cookie', 1 );

/**
 * Applies the selected checkout locale on front-end & WooCommerce AJAX requests only.
 * Enables installed WordPress/WooCommerce language packs as fallback for uncovered strings.
 */
function marianas_filter_checkout_locale( $current_locale ) {
	if ( is_admin() && ! wp_doing_ajax() ) {
		return $current_locale;
	}

	$lang      = marianas_resolve_checkout_lang();
	$supported = marianas_supported_checkout_locales();
	if ( '' === $lang || ! isset( $supported[ $lang ] ) ) {
		return $current_locale;
	}

	return $supported[ $lang ];
}
add_filter( 'locale', 'marianas_filter_checkout_locale', 20 );

/**
 * Stores the validated storefront language on created WooCommerce orders so
 * customer order emails render in the customer's selected language.
 */
function marianas_save_order_checkout_locale( $order ) {
	if ( ! is_object( $order ) || ! method_exists( $order, 'update_meta_data' ) ) {
		return;
	}

	$lang = marianas_resolve_checkout_lang();
	if ( '' === $lang ) {
		$lang = 'en';
	}

	$order->update_meta_data( '_mc_order_locale', $lang );
}
add_action( 'woocommerce_checkout_create_order', 'marianas_save_order_checkout_locale', 10, 1 );

/**
 * Activates both custom dictionary locale and WordPress locale while rendering
 * customer-facing WooCommerce order emails (leaves admin emails untouched).
 */
function marianas_email_switch_order_locale( $email ) {
	if ( ! is_object( $email ) ) {
		return;
	}
	if ( method_exists( $email, 'is_customer_email' ) && ! $email->is_customer_email() ) {
		// Explicitly keep admin notification emails in default store language during customer checkout AJAX.
		$GLOBALS['marianas_active_email_lang'] = 'en';
		return;
	}
	if ( empty( $email->object ) || ! is_object( $email->object ) || ! method_exists( $email->object, 'get_meta' ) ) {
		return;
	}

	$lang      = (string) $email->object->get_meta( '_mc_order_locale', true );
	$supported = marianas_supported_checkout_locales();
	if ( isset( $supported[ $lang ] ) ) {
		$GLOBALS['marianas_active_email_lang'] = $lang;
		if ( function_exists( 'switch_to_locale' ) ) {
			switch_to_locale( $supported[ $lang ] );
		}
	}
}
add_action( 'woocommerce_email_setup_locale', 'marianas_email_switch_order_locale', 20, 1 );

function marianas_email_restore_order_locale( $email ) {
	if ( ! is_object( $email ) ) {
		return;
	}
	$GLOBALS['marianas_active_email_lang'] = '';
	if ( method_exists( $email, 'is_customer_email' ) && ! $email->is_customer_email() ) {
		return;
	}
	if ( function_exists( 'restore_previous_locale' ) ) {
		restore_previous_locale();
	}
}
add_action( 'woocommerce_email_restore_locale', 'marianas_email_restore_order_locale', 20, 1 );
