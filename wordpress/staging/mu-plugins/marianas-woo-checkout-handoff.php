<?php
/**
 * Plugin Name: Marianas Coffee WooCommerce Checkout Handoff (STAGING REVIEW)
 * Description: Validates multi-item headless cart handoff (?mc_cart=id:qty,...) using native WooCommerce cart APIs.
 * Version: 0.1.0
 *
 * SECURITY GUARANTEES:
 * - Validates product IDs and quantities strictly on the server.
 * - Rechecks publish status, purchasability, stock, and positive database price.
 * - Never accepts client-supplied prices, discounts, or redirect URLs.
 * - Uses wp_safe_redirect() to WooCommerce's own checkout/cart URLs (PRG pattern).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MARIANAS_HANDOFF_MAX_LINES = 20;
const MARIANAS_HANDOFF_MAX_QTY   = 20;
const MARIANAS_HANDOFF_MAX_LEN   = 256;

/**
 * Parses and validates the mc_cart query string into [ product_id => quantity ].
 * Returns WP_Error on any malformed or out-of-bounds input.
 */
function marianas_parse_mc_cart_param( $raw ) {
	if ( ! is_string( $raw ) ) {
		return new WP_Error( 'invalid_cart', 'Invalid cart parameter.' );
	}

	$trimmed = trim( $raw );
	if ( '' === $trimmed || strlen( $trimmed ) > MARIANAS_HANDOFF_MAX_LEN ) {
		return new WP_Error( 'invalid_cart', 'Cart parameter length is invalid.' );
	}

	if ( 1 !== preg_match( '/^\d+:\d+(?:,\d+:\d+)*$/', $trimmed ) ) {
		return new WP_Error( 'invalid_cart', 'Cart parameter syntax is invalid.' );
	}

	$segments = explode( ',', $trimmed );
	if ( count( $segments ) > MARIANAS_HANDOFF_MAX_LINES ) {
		return new WP_Error( 'too_many_items', 'Cart exceeds maximum item limit.' );
	}

	$items = array();
	foreach ( $segments as $segment ) {
		$parts = explode( ':', $segment, 2 );
		if ( 2 !== count( $parts ) ) {
			return new WP_Error( 'invalid_cart', 'Malformed cart line.' );
		}

		$product_id = absint( $parts[0] );
		$quantity   = absint( $parts[1] );

		if ( $product_id <= 0 || $quantity <= 0 || $quantity > MARIANAS_HANDOFF_MAX_QTY ) {
			return new WP_Error( 'invalid_item', 'Cart contains an invalid product or quantity.' );
		}

		if ( isset( $items[ $product_id ] ) ) {
			return new WP_Error( 'duplicate_item', 'Duplicate product IDs are not permitted.' );
		}

		$items[ $product_id ] = $quantity;
	}

	return empty( $items ) ? new WP_Error( 'empty_cart', 'Cart is empty.' ) : $items;
}

/**
 * Validates optional language code against the strict 4-language allowlist.
 */
function marianas_handoff_valid_lang() {
	if ( empty( $_GET['lang'] ) || ! is_string( $_GET['lang'] ) ) {
		return '';
	}
	$lang = strtolower( trim( sanitize_key( wp_unslash( $_GET['lang'] ) ) ) );
	return in_array( $lang, array( 'en', 'zh', 'ko', 'ja' ), true ) ? $lang : '';
}

/**
 * Redirects safely to a WooCommerce-owned checkout or cart URL, preserving validated lang.
 */
function marianas_handoff_safe_redirect( $base_url, $lang = '' ) {
	if ( function_exists( 'nocache_headers' ) && ! headers_sent() ) {
		nocache_headers();
	}
	$target = $base_url;
	if ( '' !== $lang ) {
		$target = add_query_arg( 'lang', $lang, $target );
	}
	wp_safe_redirect( $target, 303 );
	exit;
}

/**
 * Processes /checkout/?mc_cart=<id>:<qty>,... on front-end GET requests.
 */
function marianas_handle_woo_checkout_handoff() {
	if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}

	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : '';
	if ( 'GET' !== $method ) {
		return;
	}

	if ( ! isset( $_GET['mc_cart'] ) ) {
		return;
	}

	if ( ! function_exists( 'WC' ) || ! function_exists( 'wc_get_product' ) || ! function_exists( 'wc_get_checkout_url' ) || ! function_exists( 'wc_get_cart_url' ) ) {
		return;
	}

	$lang   = marianas_handoff_valid_lang();
	$raw    = is_string( $_GET['mc_cart'] ) ? wp_unslash( $_GET['mc_cart'] ) : '';
	$parsed = marianas_parse_mc_cart_param( $raw );

	if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
		wc_load_cart();
	}

	if ( null !== WC()->session && method_exists( WC()->session, 'has_session' ) && ! WC()->session->has_session() ) {
		WC()->session->set_customer_session_cookie( true );
	}

	if ( is_wp_error( $parsed ) || null === WC()->cart ) {
		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( __( 'Your cart selection could not be verified. Please review your items and try again.', 'woocommerce' ), 'error' );
		}
		marianas_handoff_safe_redirect( wc_get_cart_url(), $lang );
	}

	// Validate every product against WooCommerce database BEFORE mutating the cart.
	$validated = array();
	foreach ( $parsed as $product_id => $quantity ) {
		$product = wc_get_product( $product_id );
		if ( ! $product instanceof WC_Product ) {
			$validated = new WP_Error( 'missing_product', 'Product not found.' );
			break;
		}

		if ( 'publish' !== $product->get_status() ) {
			$validated = new WP_Error( 'unpublished_product', 'Product is not available.' );
			break;
		}

		if ( ! $product->is_type( 'simple' ) && ! $product->is_type( 'variation' ) ) {
			$validated = new WP_Error( 'unsupported_product_type', 'Product requires option selection.' );
			break;
		}

		$raw_price = $product->get_price();
		if ( '' === $raw_price || ! is_numeric( $raw_price ) || (float) $raw_price <= 0 ) {
			$validated = new WP_Error( 'unpriced_product', 'Product price is not available.' );
			break;
		}

		if ( ! $product->is_purchasable() || ! $product->is_in_stock() ) {
			$validated = new WP_Error( 'out_of_stock', 'Product is currently out of stock.' );
			break;
		}

		if ( $product->managing_stock() && ! $product->backorders_allowed() && ! $product->has_enough_stock( $quantity ) ) {
			$validated = new WP_Error( 'insufficient_stock', 'Requested quantity exceeds available stock.' );
			break;
		}

		if ( $product->is_sold_individually() && $quantity > 1 ) {
			$validated = new WP_Error( 'sold_individually', 'Product can only be purchased one at a time.' );
			break;
		}

		$validated[] = array(
			'product_id'   => $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id(),
			'variation_id' => $product->is_type( 'variation' ) ? $product->get_id() : 0,
			'quantity'     => $quantity,
		);
	}

	if ( is_wp_error( $validated ) ) {
		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( __( 'One or more selected items are unavailable or exceed current stock. Please review your cart.', 'woocommerce' ), 'error' );
		}
		marianas_handoff_safe_redirect( wc_get_cart_url(), $lang );
	}

	// Replace session cart atomically using native WooCommerce cart APIs and DB pricing.
	WC()->cart->empty_cart();

	foreach ( $validated as $line ) {
		$added = WC()->cart->add_to_cart(
			$line['product_id'],
			$line['quantity'],
			$line['variation_id']
		);

		if ( false === $added ) {
			WC()->cart->empty_cart();
			if ( function_exists( 'wc_add_notice' ) ) {
				wc_add_notice( __( 'We could not prepare your checkout cart. Please try again.', 'woocommerce' ), 'error' );
			}
			marianas_handoff_safe_redirect( wc_get_cart_url(), $lang );
		}
	}

	WC()->cart->calculate_totals();

	if ( null !== WC()->session && method_exists( WC()->session, 'save_data' ) ) {
		WC()->session->save_data();
	}

	// Post-Redirect-Get (303) to clean checkout URL to prevent duplicate adds on refresh.
	marianas_handoff_safe_redirect( wc_get_checkout_url(), $lang );
}

add_action( 'template_redirect', 'marianas_handle_woo_checkout_handoff', 5 );
