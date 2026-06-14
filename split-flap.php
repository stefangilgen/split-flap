<?php
/**
 * Plugin Name: Split-Flap
 * Description: Animierte Fallblattanzeige (Split-Flap-Display) für WordPress – als Gutenberg-Block und als Shortcode. Reines PHP, Vanilla JS und CSS, ohne Drittanbieter-Bibliothek.
 * Version: 0.1.1
 * Author: Blitz & Donner
 * Requires at least: 6.6
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
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
define( 'SPLIT_FLAP_VERSION', '0.1.1' );

require_once SPLIT_FLAP_DIR . 'includes/render.php';
require_once SPLIT_FLAP_DIR . 'includes/assets.php';
require_once SPLIT_FLAP_DIR . 'includes/block.php';
require_once SPLIT_FLAP_DIR . 'includes/shortcode.php';

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
