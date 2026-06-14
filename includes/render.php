<?php
/**
 * Gemeinsame Render-Logik für Block und Shortcode.
 *
 * Hier leben Validierung, Normalisierung und HTML-Aufbau an genau einer Stelle.
 * Block (includes/block.php) und Shortcode (includes/shortcode.php) rufen beide
 * split_flap_render() auf – keine Logik-Duplikate.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Liefert die erlaubten Werte je Auswahl-Option.
 *
 * Wird auch von der Validierung genutzt, damit nur diese Werte durchkommen.
 *
 * @return array<string, array<int, string>>
 */
function split_flap_allowed_values() {
	return array(
		'tempo'   => array( 'langsam', 'normal', 'schnell' ),
		'start'   => array( 'zufall', 'leer', 'alpha' ),
		'zeichen' => array( 'alnum', 'zahlen', 'erweitert' ),
		'schrift' => array( 'mono', 'theme' ),
	);
}

/**
 * Gibt die Standardwerte aller Optionen zurück.
 *
 * Diese Defaults gelten gleichermassen für Block-Attribute und Shortcode-Parameter.
 * Sie entsprechen den Defaults in blocks/split-flap/block.json.
 *
 * @return array<string, mixed>
 */
function split_flap_defaults() {
	return array(
		'text'        => '',
		'felder'      => 0,      // 0 = automatisch (Länge des Textes).
		'tempo'       => 'normal',
		'start'       => 'zufall',
		'zeichen'     => 'alnum',
		'textfarbe'   => '#F4F4F4',
		'klappenfarbe' => '#1A1A1A',
		'schrift'     => 'mono',
		'grossschrift' => true,
	);
}

/**
 * Die Zeichensätze, aus denen während des Durchratterns gewürfelt wird.
 *
 * Der Schlüssel «leer» (Leerzeichen) bleibt bewusst aussen vor – Leerzeichen
 * sind ein Zielzustand, kein Rattern-Zeichen.
 *
 * @param string $satz Schlüssel aus split_flap_allowed_values()['zeichen'].
 * @return string Zeichenkette der erlaubten Glyphen.
 */
function split_flap_charset( $satz ) {
	$mengen = array(
		'alnum'     => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
		'zahlen'    => '0123456789',
		'erweitert' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-+/&%!?',
	);

	return isset( $mengen[ $satz ] ) ? $mengen[ $satz ] : $mengen['alnum'];
}

/**
 * Normalisiert und validiert die Roh-Eingaben (aus Block oder Shortcode).
 *
 * Akzeptiert sowohl die internen Schlüssel (text, felder, tempo …) als auch
 * die Shortcode-Aliase. Unbekannte Werte fallen auf den Default zurück.
 *
 * @param array<string, mixed> $args Roh-Eingaben.
 * @return array<string, mixed> Bereinigte Werte.
 */
function split_flap_sanitize_args( $args ) {
	$defaults = split_flap_defaults();
	$allowed  = split_flap_allowed_values();

	$text = isset( $args['text'] ) ? (string) $args['text'] : $defaults['text'];
	// Tags und Zeilenumbrüche entfernen – die Anzeige ist einzeilig und reiner Text.
	$text = sanitize_text_field( wp_strip_all_tags( $text ) );

	$gross = isset( $args['grossschrift'] )
		? filter_var( $args['grossschrift'], FILTER_VALIDATE_BOOLEAN )
		: $defaults['grossschrift'];

	if ( $gross ) {
		// Mehrbyte-fähige Grossschreibung, falls verfügbar.
		$text = function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $text, 'UTF-8' ) : strtoupper( $text );
	}

	$felder = isset( $args['felder'] ) ? (int) $args['felder'] : $defaults['felder'];
	if ( $felder < 0 ) {
		$felder = 0;
	}
	if ( $felder > 60 ) {
		$felder = 60; // Harte Obergrenze gegen versehentliche Riesenanzeigen.
	}

	$laenge = function_exists( 'mb_strlen' ) ? mb_strlen( $text, 'UTF-8' ) : strlen( $text );
	if ( 0 === $felder ) {
		$felder = max( 1, $laenge );
	}

	$tempo   = ( isset( $args['tempo'] ) && in_array( $args['tempo'], $allowed['tempo'], true ) ) ? $args['tempo'] : $defaults['tempo'];
	$start   = ( isset( $args['start'] ) && in_array( $args['start'], $allowed['start'], true ) ) ? $args['start'] : $defaults['start'];
	$zeichen = ( isset( $args['zeichen'] ) && in_array( $args['zeichen'], $allowed['zeichen'], true ) ) ? $args['zeichen'] : $defaults['zeichen'];
	$schrift = ( isset( $args['schrift'] ) && in_array( $args['schrift'], $allowed['schrift'], true ) ) ? $args['schrift'] : $defaults['schrift'];

	$textfarbe   = split_flap_sanitize_color( isset( $args['textfarbe'] ) ? $args['textfarbe'] : '', $defaults['textfarbe'] );
	$klappenfarbe = split_flap_sanitize_color( isset( $args['klappenfarbe'] ) ? $args['klappenfarbe'] : '', $defaults['klappenfarbe'] );

	return array(
		'text'         => $text,
		'felder'       => $felder,
		'tempo'        => $tempo,
		'start'        => $start,
		'zeichen'      => $zeichen,
		'textfarbe'    => $textfarbe,
		'klappenfarbe' => $klappenfarbe,
		'schrift'      => $schrift,
		'grossschrift' => $gross,
	);
}

/**
 * Säubert einen Farbwert auf ein Hex-Format und fällt sonst auf den Default zurück.
 *
 * @param string $value   Roh-Eingabe.
 * @param string $default Default-Hex.
 * @return string Gültiger Hex-Farbwert.
 */
function split_flap_sanitize_color( $value, $default ) {
	$value = is_string( $value ) ? trim( $value ) : '';
	$hex   = sanitize_hex_color( $value );

	return $hex ? $hex : $default;
}

/**
 * Zerlegt einen Text mehrbyte-sicher in einzelne Zeichen und füllt/kürzt auf $felder.
 *
 * @param string $text   Zieltext.
 * @param int    $felder Anzahl Klappen.
 * @return array<int, string> Genau $felder Einträge, jeder ein einzelnes Zeichen oder ''.
 */
function split_flap_split_text( $text, $felder ) {
	if ( function_exists( 'mb_str_split' ) ) {
		$chars = mb_str_split( $text, 1, 'UTF-8' );
	} else {
		$chars = preg_split( '//u', $text, -1, PREG_SPLIT_NO_EMPTY );
		if ( false === $chars ) {
			$chars = array();
		}
	}

	$chars = array_slice( $chars, 0, $felder );
	while ( count( $chars ) < $felder ) {
		$chars[] = ' ';
	}

	return $chars;
}

/**
 * Baut das HTML-Markup einer Split-Flap-Anzeige.
 *
 * Diese Funktion ist die einzige Render-Quelle für Block und Shortcode.
 * Sie gibt fertiges, vollständig escaptes HTML zurück.
 *
 * @param array<string, mixed> $args Roh-Eingaben aus Block oder Shortcode.
 * @return string HTML-Markup.
 */
function split_flap_render( $args ) {
	$o = split_flap_sanitize_args( $args );

	$chars = split_flap_split_text( $o['text'], $o['felder'] );

	$tempo_dauer = array(
		'langsam' => 90,
		'normal'  => 55,
		'schnell' => 30,
	);
	$flip_ms = isset( $tempo_dauer[ $o['tempo'] ] ) ? $tempo_dauer[ $o['tempo'] ] : $tempo_dauer['normal'];

	$schrift_class = 'theme' === $o['schrift'] ? 'split-flap--font-theme' : 'split-flap--font-mono';

	// Inline-Custom-Properties: nur escapte Hex-Farben und ganze Zahlen.
	$style = sprintf(
		'--sf-text:%1$s;--sf-flap:%2$s;--sf-flip-ms:%3$dms;',
		esc_attr( $o['textfarbe'] ),
		esc_attr( $o['klappenfarbe'] ),
		(int) $flip_ms
	);

	// Daten für das JS: Charset und Startmodus stecken in data-Attributen.
	$charset = split_flap_charset( $o['zeichen'] );

	$out  = '<div class="split-flap ' . esc_attr( $schrift_class ) . '"';
	$out .= ' style="' . esc_attr( $style ) . '"';
	$out .= ' data-sf-start="' . esc_attr( $o['start'] ) . '"';
	$out .= ' data-sf-charset="' . esc_attr( $charset ) . '">';

	// Screenreader-Text: zusammenhängender String, visuell versteckt.
	// Bewusst kein zusätzliches aria-label am Container, sonst läse der
	// Screenreader den Text doppelt vor.
	$out .= '<span class="split-flap__sr">' . esc_html( trim( $o['text'] ) ) . '</span>';

	// Die sichtbaren Klappen sind dekorativ → aria-hidden.
	$out .= '<span class="split-flap__board" aria-hidden="true">';

	foreach ( $chars as $char ) {
		$is_space = ( ' ' === $char || '' === $char );
		$cell_class = 'split-flap__cell' . ( $is_space ? ' split-flap__cell--space' : '' );

		$out .= '<span class="' . esc_attr( $cell_class ) . '" data-sf-target="' . esc_attr( $char ) . '">';
		$out .= '<span class="split-flap__char">' . esc_html( $is_space ? '' : $char ) . '</span>';
		$out .= '</span>';
	}

	$out .= '</span>'; // .split-flap__board
	$out .= '</div>';  // .split-flap

	return $out;
}
