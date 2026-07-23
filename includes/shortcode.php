<?php
/**
 * Registriert den Shortcode [split_flap_board] (mehrzeiliges Board).
 *
 * Der Shortcode mappt seine Parameter auf die internen Schlüssel und ruft dieselbe
 * Render-Funktion wie der Block auf. So bleibt das Ergebnis identisch und es gibt
 * keine Logik-Duplikate.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handler für [split_flap_board] (mehrzeiliges Board mit Szenen und Farbflaps).
 *
 * Szenen kommen als Attribute scene1, scene2 … Innerhalb einer Szene trennt «|»
 * die Board-Zeilen. Fehlt jedes scene-Attribut, fällt der Handler auf eine leere
 * Szene zurück.
 *
 * Beispiel:
 *   [split_flap_board
 *     scene1="ABFAHRT GLEIS 7|ZUG NACH BERN {1} 10:32"
 *     scene2="ANKUNFT GLEIS 3|ZUG AUS THUN {6} 10:48"
 *     zeilen="6" stellen="25" intervall="6" tempo="normal"]
 *
 * @param array<string, mixed>|string $atts Shortcode-Attribute.
 * @return string HTML-Markup.
 */
function split_flap_board_shortcode( $atts ) {
	$atts = is_array( $atts ) ? array_change_key_case( $atts, CASE_LOWER ) : array();

	$defaults = array(
		'zeilen'       => '1',
		'stellen'      => '25',
		'intervall'    => '6',
		'tempo'        => 'normal',
		'stil'         => 'sequenziell',
		'zeichen'      => 'alnum',
		'start'        => 'zufall',
		'schrift'      => 'mono',
		'grossschrift' => 'true',
		'farben'       => '',
		'textfarbe'    => '#C8C8C8',
		'klappenfarbe' => '#1A1A1A',
		'rahmenfarbe'  => '#303030',
	);

	// Szenen-Attribute (scene1 … sceneN) einsammeln, der Reihe nach.
	$szenen = array();
	$n      = 1;
	while ( isset( $atts[ 'scene' . $n ] ) ) {
		// Innerhalb einer Szene trennt «|» die Board-Zeilen → Zeilenumbruch.
		$roh        = (string) $atts[ 'scene' . $n ];
		$szenen[]   = str_replace( '|', "\n", $roh );
		$n++;
	}
	if ( empty( $szenen ) ) {
		$szenen = array( '' );
	}

	$merged = shortcode_atts( $defaults, $atts, 'split_flap_board' );

	$board_args = array(
		'szenen'       => $szenen,
		'zeilen'       => $merged['zeilen'],
		'stellen'      => $merged['stellen'],
		'intervall'    => $merged['intervall'],
		'tempo'        => strtolower( (string) $merged['tempo'] ),
		'stil'         => strtolower( (string) $merged['stil'] ),
		'zeichen'      => strtolower( (string) $merged['zeichen'] ),
		'start'        => strtolower( (string) $merged['start'] ),
		'schrift'      => strtolower( (string) $merged['schrift'] ),
		'grossschrift' => $merged['grossschrift'],
		'farben'       => $merged['farben'],
		'textfarbe'    => $merged['textfarbe'],
		'klappenfarbe' => $merged['klappenfarbe'],
		'rahmenfarbe'  => $merged['rahmenfarbe'],
	);

	split_flap_enqueue_frontend();

	return split_flap_render_board( $board_args );
}
add_shortcode( 'split_flap_board', 'split_flap_board_shortcode' );

/**
 * Reiht die Frontend-Assets früh ein, wenn der aktuelle Post den Shortcode
 * enthält. Läuft auf wp_enqueue_scripts, also vor wp_head, damit das CSS sicher
 * im <head> landet. Das bedingte Enqueue bleibt erhalten.
 *
 * @return void
 */
function split_flap_enqueue_shortcode_assets() {
	if ( is_admin() ) {
		return;
	}

	$post = get_post();

	if ( $post instanceof WP_Post && has_shortcode( $post->post_content, 'split_flap_board' ) ) {
		split_flap_enqueue_frontend();
	}
}
add_action( 'wp_enqueue_scripts', 'split_flap_enqueue_shortcode_assets' );
