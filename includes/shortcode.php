<?php
/**
 * Registriert den Shortcode [split_flap].
 *
 * Beispiel:
 *   [split_flap text="ABFAHRT" felder="7" tempo="normal" start="zufall"]
 *
 * Der Shortcode mappt seine Parameter (deutsche Aliase) auf die internen Schlüssel
 * und ruft dieselbe Render-Funktion wie der Block auf. So bleibt das Ergebnis
 * identisch und es gibt keine Logik-Duplikate.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Übersetzt die menschenfreundlichen Shortcode-Werte auf die internen Schlüssel.
 *
 * Erlaubt z.B. start="alphabetisch" oder zeichensatz="zahlen". Unbekannte Werte
 * fallen in split_flap_sanitize_args() automatisch auf den Default zurück.
 *
 * @param array<string, mixed> $atts Bereinigte Shortcode-Attribute.
 * @return array<string, mixed> Auf interne Schlüssel gemappte Werte.
 */
function split_flap_map_shortcode_atts( $atts ) {
	$start_map = array(
		'zufall'        => 'zufall',
		'zufallszeichen' => 'zufall',
		'leer'          => 'leer',
		'alpha'         => 'alpha',
		'alphabetisch'  => 'alpha',
		'a-z'           => 'alpha',
	);

	$zeichen_map = array(
		'alnum'      => 'alnum',
		'a-z0-9'     => 'alnum',
		'standard'   => 'alnum',
		'zahlen'     => 'zahlen',
		'nur-zahlen' => 'zahlen',
		'erweitert'  => 'erweitert',
	);

	$schrift_map = array(
		'mono'  => 'mono',
		'theme' => 'theme',
	);

	$start_key   = strtolower( (string) $atts['start'] );
	$zeichen_key = strtolower( (string) $atts['zeichensatz'] );
	$schrift_key = strtolower( (string) $atts['schrift'] );

	return array(
		'text'         => $atts['text'],
		'felder'       => $atts['felder'],
		'tempo'        => strtolower( (string) $atts['tempo'] ),
		'start'        => isset( $start_map[ $start_key ] ) ? $start_map[ $start_key ] : $start_key,
		'zeichen'      => isset( $zeichen_map[ $zeichen_key ] ) ? $zeichen_map[ $zeichen_key ] : $zeichen_key,
		'textfarbe'    => $atts['textfarbe'],
		'klappenfarbe' => $atts['klappenfarbe'],
		'schrift'      => isset( $schrift_map[ $schrift_key ] ) ? $schrift_map[ $schrift_key ] : $schrift_key,
		'grossschrift' => $atts['grossschrift'],
	);
}

/**
 * Handler für [split_flap].
 *
 * @param array<string, mixed>|string $atts Shortcode-Attribute.
 * @return string HTML-Markup.
 */
function split_flap_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'text'         => '',
			'felder'       => '0',
			'tempo'        => 'normal',
			'start'        => 'zufall',
			'zeichensatz'  => 'alnum',
			'textfarbe'    => '#F4F4F4',
			'klappenfarbe' => '#1A1A1A',
			'schrift'      => 'mono',
			'grossschrift' => 'true',
		),
		is_array( $atts ) ? array_change_key_case( $atts, CASE_LOWER ) : array(),
		'split_flap'
	);

	// Fallback-Enqueue für Fälle ausserhalb des Post-Contents (Widgets, Template-
	// Aufrufe via do_shortcode). Im Normalfall hat der frühe Hook unten bereits
	// eingereiht; ein doppeltes wp_enqueue_style() ist unschädlich.
	split_flap_enqueue_frontend();

	return split_flap_render( split_flap_map_shortcode_atts( $atts ) );
}
add_shortcode( 'split_flap', 'split_flap_shortcode' );

/**
 * Reiht die Frontend-Assets früh ein, wenn der aktuelle Post den Shortcode enthält.
 *
 * Läuft auf wp_enqueue_scripts – also vor wp_head. So landet das CSS zuverlässig
 * im <head>, statt erst beim Rendern im Body angemeldet zu werden (was in
 * Standard-Themes zu spät kommt). Das bedingte Enqueue bleibt erhalten: ohne
 * Shortcode im Content wird nichts geladen.
 *
 * @return void
 */
function split_flap_enqueue_shortcode_assets() {
	if ( is_admin() ) {
		return;
	}

	$post = get_post();

	if ( $post instanceof WP_Post && has_shortcode( $post->post_content, 'split_flap' ) ) {
		split_flap_enqueue_frontend();
	}
}
add_action( 'wp_enqueue_scripts', 'split_flap_enqueue_shortcode_assets' );
