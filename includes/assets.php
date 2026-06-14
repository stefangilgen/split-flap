<?php
/**
 * Asset-Verwaltung: registriert Frontend-CSS/JS und sorgt für bedingtes Enqueue.
 *
 * Auf Seiten ohne Split-Flap-Block und ohne Shortcode werden weder CSS noch JS
 * geladen. Der Block lädt seine Assets über block.json (script/style/viewScript)
 * automatisch nur bei Vorkommen; der Shortcode meldet den Bedarf selbst an.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registriert die Frontend-Handles, ohne sie einzureihen.
 *
 * @return void
 */
function split_flap_register_assets() {
	wp_register_style(
		'split-flap',
		SPLIT_FLAP_URL . 'assets/css/split-flap.css',
		array(),
		SPLIT_FLAP_VERSION
	);

	wp_register_script(
		'split-flap',
		SPLIT_FLAP_URL . 'assets/js/split-flap.js',
		array(),
		SPLIT_FLAP_VERSION,
		true
	);
}
add_action( 'init', 'split_flap_register_assets' );

/**
 * Reiht die Frontend-Assets ein. Wird vom Shortcode aufgerufen.
 *
 * Der Block nutzt das automatische Enqueue aus block.json; dieselben Handles
 * werden geteilt, sodass keine Doppelladung entsteht.
 *
 * @return void
 */
function split_flap_enqueue_frontend() {
	wp_enqueue_style( 'split-flap' );
	wp_enqueue_script( 'split-flap' );
}
