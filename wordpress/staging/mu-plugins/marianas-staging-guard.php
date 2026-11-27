<?php
/**
 * Plugin Name: Marianas Coffee Staging Guard (STAGING ONLY)
 * Description: Prevents indexing and accidental live payments on the WooCommerce staging host, with optional email suppression.
 * Version: 0.2.0
 *
 * SECURITY NOTICE:
 * - Intended ONLY for regionaltest.shop.marianascoffee.com.
 * - Never install on production (shop.marianascoffee.com).
 * - Fail-safe: exits immediately if HTTP_HOST does not match the configured staging host.
 *
 * CONFIGURATION (optional constants in staging wp-config.php):
 * - MARIANAS_STAGING_HOST: defaults to 'regionaltest.shop.marianascoffee.com'.
 * - MARIANAS_STAGING_SUPPRESS_EMAILS: defaults to false (owner test emails enabled).
 *   Set to true in staging wp-config.php to suppress all outgoing WordPress & WooCommerce emails.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MARIANAS_STAGING_HOST' ) ) {
	define( 'MARIANAS_STAGING_HOST', 'regionaltest.shop.marianascoffee.com' );
}

if ( ! defined( 'MARIANAS_STAGING_SUPPRESS_EMAILS' ) ) {
	define( 'MARIANAS_STAGING_SUPPRESS_EMAILS', false );
}

/**
 * Returns the normalized current HTTP host without port, or empty string if unavailable.
 */
function marianas_staging_current_host() {
	if ( empty( $_SERVER['HTTP_HOST'] ) || ! is_string( $_SERVER['HTTP_HOST'] ) ) {
		return '';
	}
	$host = strtolower( trim( wp_unslash( $_SERVER['HTTP_HOST'] ) ) );
	$host = preg_replace( '/:\d+$/', '', $host );
	return is_string( $host ) ? $host : '';
}

/**
 * Strict host allowlist check. Never applies staging blocks on production.
 */
function marianas_is_expected_staging_host() {
	$expected = strtolower( trim( (string) MARIANAS_STAGING_HOST ) );
	$current  = marianas_staging_current_host();
	return '' !== $expected && '' !== $current && hash_equals( $expected, $current );
}

/**
 * Whether staging outgoing email suppression is enabled via MARIANAS_STAGING_SUPPRESS_EMAILS.
 */
function marianas_staging_should_suppress_emails() {
	return true === MARIANAS_STAGING_SUPPRESS_EMAILS;
}

if ( ! marianas_is_expected_staging_host() ) {
	// Fail-safe: if copied to production or another host, do not modify live mail, robots, or checkout.
	if ( '' !== marianas_staging_current_host() ) {
		error_log( 'Marianas Staging Guard is present on a non-staging host and has disabled itself.' );
	}
	return;
}

// 1. Block search engine indexing at header, meta, option, and robots.txt levels.
add_action(
	'send_headers',
	function () {
		if ( ! headers_sent() ) {
			header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
		}
	}
);

add_filter(
	'pre_option_blog_public',
	function () {
		return '0';
	}
);

add_filter(
	'wp_robots',
	function ( $robots ) {
		if ( ! is_array( $robots ) ) {
			$robots = array();
		}
		$robots['noindex']   = true;
		$robots['nofollow']  = true;
		$robots['noarchive'] = true;
		return $robots;
	},
	999
);

add_filter(
	'robots_txt',
	function () {
		return "User-agent: *\nDisallow: /\n";
	},
	999
);

// 2. Configurable outgoing email suppression (disabled by default for controlled owner staging tests).
if ( marianas_staging_should_suppress_emails() ) {
	add_filter(
		'pre_wp_mail',
		function ( $null, $atts ) {
			if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
				$subject = isset( $atts['subject'] ) && is_string( $atts['subject'] ) ? sanitize_text_field( $atts['subject'] ) : '';
				$to_list = isset( $atts['to'] ) ? ( is_array( $atts['to'] ) ? count( $atts['to'] ) : 1 ) : 0;
				error_log( sprintf( '[Marianas Staging Guard] Suppressed outgoing email (recipients=%d, subject="%s")', $to_list, $subject ) );
			}
			// Returning true short-circuits wp_mail() cleanly without sending.
			return true;
		},
		999,
		2
	);

	add_filter(
		'woocommerce_mail_callback',
		function () {
			return '__return_true';
		},
		999
	);
}

// 3. Modular live-payment safety checks (read-only option inspection; blocks live gateways on staging).
function marianas_staging_has_live_stripe_config() {
	$settings = get_option( 'woocommerce_stripe_settings', array() );
	if ( ! is_array( $settings ) || empty( $settings ) ) {
		return false;
	}

	$enabled  = isset( $settings['enabled'] ) && 'yes' === $settings['enabled'];
	$testmode = isset( $settings['testmode'] ) && 'yes' === $settings['testmode'];

	if ( $enabled && ! $testmode ) {
		return true;
	}

	$key_fields = array( 'publishable_key', 'secret_key', 'test_publishable_key', 'test_secret_key' );
	foreach ( $key_fields as $field ) {
		if ( isset( $settings[ $field ] ) && is_string( $settings[ $field ] ) ) {
			$val = trim( $settings[ $field ] );
			if ( 0 === strpos( $val, 'pk_live_' ) || 0 === strpos( $val, 'sk_live_' ) || 0 === strpos( $val, 'rk_live_' ) ) {
				if ( ! $testmode || 0 === strpos( $field, 'test_' ) ) {
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Checks whether a non-offline online payment gateway is configured in live mode on staging.
 * Offline gateways (cod, bacs, cheque) are always safe for non-transactional staging tests.
 */
function marianas_staging_is_live_online_gateway( $gateway_id ) {
	$id = strtolower( (string) $gateway_id );

	// Offline/manual gateways never process live card charges.
	if ( in_array( $id, array( 'cod', 'bacs', 'cheque' ), true ) ) {
		return false;
	}

	// Stripe family.
	if ( 'stripe' === $id || 0 === strpos( $id, 'stripe_' ) ) {
		return marianas_staging_has_live_stripe_config();
	}

	// Other common online payment gateways: block unless explicitly configured in test/sandbox mode.
	$online_option_checks = array(
		'woocommerce_payments' => array( 'option' => 'woocommerce_woocommerce_payments_settings', 'flag' => 'test_mode', 'expected' => 'yes' ),
		'ppcp-gateway'         => array( 'option' => 'woocommerce-ppcp-settings', 'flag' => 'sandbox_on', 'expected' => true ),
		'paypal'               => array( 'option' => 'woocommerce_paypal_settings', 'flag' => 'testmode', 'expected' => 'yes' ),
		'square_credit_card'   => array( 'option' => 'woocommerce_square_settings', 'flag' => 'enable_sandbox', 'expected' => 'yes' ),
	);

	if ( isset( $online_option_checks[ $id ] ) ) {
		$check    = $online_option_checks[ $id ];
		$settings = get_option( $check['option'], array() );
		if ( ! is_array( $settings ) ) {
			return true;
		}
		$flag_val = $settings[ $check['flag'] ] ?? null;
		return $flag_val !== $check['expected'];
	}

	// Any 2Checkout / Verifone gateway ID is blocked unless test/demo mode is explicitly enabled.
	if ( false !== strpos( $id, '2checkout' ) || false !== strpos( $id, 'twocheckout' ) ) {
		$settings = get_option( 'woocommerce_' . $id . '_settings', array() );
		if ( ! is_array( $settings ) ) {
			return true;
		}
		$demo = $settings['demo'] ?? $settings['testmode'] ?? $settings['sandbox'] ?? 'no';
		return ! in_array( $demo, array( 'yes', '1', 1, true ), true );
	}

	return false;
}

add_filter(
	'woocommerce_available_payment_gateways',
	function ( $gateways ) {
		if ( ! is_array( $gateways ) ) {
			return $gateways;
		}
		foreach ( array_keys( $gateways ) as $gateway_id ) {
			if ( marianas_staging_is_live_online_gateway( $gateway_id ) ) {
				unset( $gateways[ $gateway_id ] );
			}
		}
		return $gateways;
	},
	999
);

add_action(
	'admin_notices',
	function () {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$email_status = marianas_staging_should_suppress_emails()
			? 'Outgoing emails are suppressed (MARIANAS_STAGING_SUPPRESS_EMAILS = true).'
			: 'Outgoing owner test emails are enabled (MARIANAS_STAGING_SUPPRESS_EMAILS = false).';

		echo '<div class="notice notice-warning"><p><strong>Marianas Staging Environment:</strong> Search indexing is blocked on this host. ' . esc_html( $email_status ) . '</p></div>';
		if ( marianas_staging_has_live_stripe_config() ) {
			echo '<div class="notice notice-error"><p><strong>Payment Safety Lock Active:</strong> Live Stripe configuration was detected on staging. Stripe checkout gateways have been disabled on this host until test mode and test keys are confirmed.</p></div>';
		}
	}
);
