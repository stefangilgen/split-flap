<?php
/**
 * Plugin Name: Split-Flap
 * Description: Animierte Fallblattanzeige (Split-Flap-Display) für WordPress – einzeilig oder als mehrzeiliges Board mit Szenen-Wechsel und Farbflaps. Als Gutenberg-Block und als Shortcode. Reines PHP, Vanilla JS und CSS, ohne Drittanbieter-Bibliothek.
 * Version: 0.4.1
 * Author: Blitz & Donner
 * Requires at least: 6.6
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Update URI: https://plugins.blitzdonner.ch/split-flap
 * Text Domain: split-flap
 * Domain Path: /languages
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SPLIT_FLAP_FILE', __FILE__ );
define( 'SPLIT_FLAP_DIR', plugin_dir_path( __FILE__ ) );
define( 'SPLIT_FLAP_URL', plugin_dir_url( __FILE__ ) );
define( 'SPLIT_FLAP_VERSION', '0.4.1' );

require_once SPLIT_FLAP_DIR . 'includes/render.php';
require_once SPLIT_FLAP_DIR . 'includes/assets.php';
require_once SPLIT_FLAP_DIR . 'includes/block.php';
require_once SPLIT_FLAP_DIR . 'includes/shortcode.php';

/*
 * Update-Client: bezieht Updates vom Self-hosted Server (plugins.blitzdonner.ch).
 * Kein Killswitch – bei fehlendem/gesperrtem Token wird nur das Update verweigert,
 * das Plugin bleibt voll funktionsfähig (GPL-Grenze). Split-Flap ist ein freies
 * Plugin, darum bleiben die Token-Felder in der Regel ungesetzt.
 *
 * Früh auf plugins_loaded: Der Filter pre_set_site_transient_update_plugins muss
 * registriert sein, BEVOR WordPress den update_plugins-Transient befüllt (auch im
 * Cron-Loopback) – sonst blendet WP die Auto-Update-Schaltung aus.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( ! class_exists( 'BD_Update_Client' ) ) {
			require_once SPLIT_FLAP_DIR . 'includes/class-bd-update-client.php';
		}
		new BD_Update_Client(
			array(
				'plugin_file' => SPLIT_FLAP_FILE,
				'slug'        => 'split-flap',
				'server_url'  => 'https://plugins.blitzdonner.ch',
				'version'     => SPLIT_FLAP_VERSION,
				'option_key'  => 'split_flap_license_token',
				'const_key'   => 'SPLIT_FLAP_LICENSE_TOKEN',
			)
		);
	}
);

/**
 * Lädt die Übersetzungen gemäss WordPress-Locale.
 *
 * @return void
 */
function split_flap_load_textdomain() {
	load_plugin_textdomain(
		'split-flap',
		false,
		dirname( plugin_basename( SPLIT_FLAP_FILE ) ) . '/languages'
	);
}
add_action( 'init', 'split_flap_load_textdomain', 1 );
