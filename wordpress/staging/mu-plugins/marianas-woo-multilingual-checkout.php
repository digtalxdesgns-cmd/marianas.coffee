<?php
/**
 * Plugin Name: Marianas Coffee Multilingual Checkout (STAGING REVIEW)
 * Description: Preserves the selected storefront language (en, zh, ko, ja) across WooCommerce checkout and order metadata.
 * Version: 0.1.0
 *
 * NOTES:
 * - Strict 4-language allowlist only: en -> en_US, zh -> zh_CN, ko -> ko_KR, ja -> ja_JP.
 * - Requires WordPress / WooCommerce language packs (zh_CN, ko_KR, ja) installed on the
 *   WordPress instance for WooCommerce UI strings and order emails to render translated.
 * - Does not alter WP-Admin user locales or WooCommerce prices/payments.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MARIANAS_LANG_COOKIE_NAME = 'mc_checkout_lang';
const MARIANAS_LANG_COOKIE_TTL  = 604800; // 7 days.

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
 * order confirmation emails can match the customer's selected language.
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
 * Switches WordPress locale while rendering customer-facing WooCommerce order emails.
 */
function marianas_email_switch_order_locale( $email ) {
	if ( ! function_exists( 'switch_to_locale' ) || ! is_object( $email ) ) {
		return;
	}
	if ( empty( $email->object ) || ! is_object( $email->object ) || ! method_exists( $email->object, 'get_meta' ) ) {
		return;
	}
	if ( method_exists( $email, 'is_customer_email' ) && ! $email->is_customer_email() ) {
		return;
	}

	$lang      = (string) $email->object->get_meta( '_mc_order_locale', true );
	$supported = marianas_supported_checkout_locales();
	if ( isset( $supported[ $lang ] ) ) {
		switch_to_locale( $supported[ $lang ] );
	}
}
add_action( 'woocommerce_email_setup_locale', 'marianas_email_switch_order_locale', 20, 1 );

function marianas_email_restore_order_locale( $email ) {
	if ( ! function_exists( 'restore_previous_locale' ) || ! is_object( $email ) ) {
		return;
	}
	if ( method_exists( $email, 'is_customer_email' ) && ! $email->is_customer_email() ) {
		return;
	}
	restore_previous_locale();
}
add_action( 'woocommerce_email_restore_locale', 'marianas_email_restore_order_locale', 20, 1 );
