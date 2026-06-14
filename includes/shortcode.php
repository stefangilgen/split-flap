<?php
/**
 * Registriert die Shortcodes [split_flap] (einzeilig, v1) und
 * [split_flap_board] (mehrzeiliges Board, v2).
 *
 * Beide mappen ihre Parameter auf die internen Schlüssel und rufen dieselbe
 * Render-Funktion wie der jeweilige Block auf. So bleibt das Ergebnis identisch
 * und es gibt keine Logik-Duplikate.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Übersetzt die menschenfreundlichen Shortcode-Werte auf die internen Schlüssel.
 *
 * @param array<string, mixed> $atts Bereinigte Shortcode-Attribute.
 * @return array<string, mixed> Auf interne Schlüssel gemappte Werte.
 */
function split_flap_map_shortcode_atts( $atts ) {
	$schrift_map = array(
		'mono'  => 'mono',
		'theme' => 'theme',
	);

	$schrift_key = strtolower( (string) $atts['schrift'] );

	return array(
		'text'         => $atts['text'],
		'felder'       => $atts['felder'],
		'tempo'        => strtolower( (string) $atts['tempo'] ),
		'textfarbe'    => $atts['textfarbe'],
		'klappenfarbe' => $atts['klappenfarbe'],
		'schrift'      => isset( $schrift_map[ $schrift_key ] ) ? $schrift_map[ $schrift_key ] : $schrift_key,
		'grossschrift' => $atts['grossschrift'],
	);
}

/**
 * Handler für [split_flap] (einzeilige v1-Anzeige).
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
			'textfarbe'    => '#C8C8C8',
			'klappenfarbe' => '#1A1A1A',
			'schrift'      => 'mono',
			'grossschrift' => 'true',
		),
		is_array( $atts ) ? array_change_key_case( $atts, CASE_LOWER ) : array(),
		'split_flap'
	);

	split_flap_enqueue_frontend();

	return split_flap_render( split_flap_map_shortcode_atts( $atts ) );
}
add_shortcode( 'split_flap', 'split_flap_shortcode' );

/**
 * Handler für [split_flap_board] (mehrzeiliges Board mit Szenen, Farbflaps, Sound).
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
		'zeilen'       => '6',
		'stellen'      => '25',
		'intervall'    => '6',
		'tempo'        => 'normal',
		'schrift'      => 'mono',
		'grossschrift' => 'true',
		'farben'       => '',
		'textfarbe'    => '#C8C8C8',
		'klappenfarbe' => '#1A1A1A',
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
		'schrift'      => strtolower( (string) $merged['schrift'] ),
		'grossschrift' => $merged['grossschrift'],
		'farben'       => $merged['farben'],
		'textfarbe'    => $merged['textfarbe'],
		'klappenfarbe' => $merged['klappenfarbe'],
	);

	split_flap_enqueue_frontend();

	return split_flap_render_board( $board_args );
}
add_shortcode( 'split_flap_board', 'split_flap_board_shortcode' );

/**
 * Reiht die Frontend-Assets früh ein, wenn der aktuelle Post einen der Shortcodes
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

	if ( $post instanceof WP_Post
		&& ( has_shortcode( $post->post_content, 'split_flap' )
			|| has_shortcode( $post->post_content, 'split_flap_board' ) ) ) {
		split_flap_enqueue_frontend();
	}
}
add_action( 'wp_enqueue_scripts', 'split_flap_enqueue_shortcode_assets' );
