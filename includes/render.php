<?php
/**
 * Gemeinsame Render-Logik für Block und Shortcode.
 *
 * Hier leben Validierung, Normalisierung und HTML-Aufbau an genau einer Stelle.
 * Block (includes/block.php) und Shortcode (includes/shortcode.php) rufen beide
 * dieselbe Render-Funktion auf – keine Logik-Duplikate.
 *
 * v2 führt das mehrzeilige Board ein. Die einzeilige v1-Anzeige ist der Sonderfall
 * «Board mit einer Zeile»: split_flap_render() (v1) ruft intern split_flap_render_board().
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
 * Gibt die Standardwerte aller v1-Optionen zurück.
 *
 * Diese Defaults gelten für die einzeilige Anzeige (Block- und Shortcode-Sonderfall).
 *
 * @return array<string, mixed>
 */
function split_flap_defaults() {
	return array(
		'text'         => '',
		'felder'       => 0,      // 0 = automatisch (Länge des Textes).
		'tempo'        => 'normal',
		'start'        => 'zufall',
		'zeichen'      => 'alnum',
		'textfarbe'    => '#F4F4F4',
		'klappenfarbe' => '#1A1A1A',
		'schrift'      => 'mono',
		'grossschrift' => true,
	);
}

/**
 * Die 15 Default-Farbflaps (Index 1–15), gemäss Spezifikation v2 Abschnitt 3.
 *
 * @return array<int, string> Indexiert von 0 (= Farbflap 1) bis 14 (= Farbflap 15).
 */
function split_flap_default_palette() {
	return array(
		'#E23B2E', // 1 Rot
		'#F08A24', // 2 Orange
		'#F4B400', // 3 Bernstein
		'#FCE300', // 4 Gelb
		'#A8C700', // 5 Limette
		'#2EA84F', // 6 Grün
		'#0F9D8C', // 7 Smaragd
		'#1FB6C1', // 8 Türkis
		'#2D9CDB', // 9 Hellblau
		'#2D6CDF', // 10 Blau
		'#4B47C4', // 11 Indigo
		'#8E44C4', // 12 Violett
		'#D43BA8', // 13 Magenta
		'#2B2B2B', // 14 Anthrazit
		'#F4F4F4', // 15 Weiss
	);
}

/**
 * Die Zeichensätze, aus denen während des Durchratterns gewürfelt wird.
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
 * Validiert eine 15er-Farbpalette gegen das Hex-Muster.
 *
 * Akzeptiert ein Array oder eine kommagetrennte Liste. Jeder ungültige oder
 * fehlende Eintrag fällt auf den passenden Default aus split_flap_default_palette()
 * zurück. Das Ergebnis hat immer genau 15 gültige Hex-Werte.
 *
 * @param array<int, string>|string|null $farben Roh-Eingabe.
 * @return array<int, string> 15 gültige Hex-Werte (Index 0–14).
 */
function split_flap_sanitize_palette( $farben ) {
	$default = split_flap_default_palette();

	if ( is_string( $farben ) ) {
		$farben = '' === trim( $farben ) ? array() : array_map( 'trim', explode( ',', $farben ) );
	}
	if ( ! is_array( $farben ) ) {
		$farben = array();
	}

	$out = array();
	for ( $i = 0; $i < 15; $i++ ) {
		$raw      = isset( $farben[ $i ] ) ? $farben[ $i ] : '';
		$out[ $i ] = split_flap_sanitize_color( $raw, $default[ $i ] );
	}

	return $out;
}

/**
 * Zerlegt einen String mehrbyte-sicher in einzelne Zeichen.
 *
 * @param string $text Eingabe.
 * @return array<int, string> Zeichen.
 */
function split_flap_chars( $text ) {
	if ( function_exists( 'mb_str_split' ) ) {
		return mb_str_split( $text, 1, 'UTF-8' );
	}

	$chars = preg_split( '//u', $text, -1, PREG_SPLIT_NO_EMPTY );

	return false === $chars ? array() : $chars;
}

/**
 * Parst eine einzelne Board-Zeile in eine Liste von Stellen.
 *
 * Jede Stelle ist entweder ein einzelnes Zeichen (A–Z, 0–9, Leerzeichen) oder ein
 * Farbflap. Die Syntax {1}–{15} belegt genau eine Stelle mit dem jeweiligen Farbflap.
 *
 * Parser-Regeln (Spezifikation v2 Abschnitt 2):
 *  - {1}…{15} → Farbflap, genau eine Stelle.
 *  - {0}, {16}+, {}, {ab} → als Literaltext behandeln, ergibt Leer-Klappen.
 *  - Geschweifte Klammern zählen nie als eigene Stelle; nur der erkannte Block belegt eine.
 *
 * @param string $zeile     Roh-Zeile (bereits gross/klein normalisiert).
 * @param bool   $grossschrift Wandelt Buchstaben in Grossbuchstaben.
 * @return array<int, array{type:string, value:string}> Liste von Stellen.
 */
function split_flap_parse_line( $zeile, $grossschrift ) {
	$stellen = array();
	$len     = strlen( $zeile ); // Byte-Index, weil {n} reines ASCII ist.
	$i       = 0;

	// Mehrbyte-sichere Iteration: wir laufen über die Zeichen, erkennen aber
	// {n}-Sequenzen anhand der Zeichen selbst.
	$chars = split_flap_chars( $zeile );
	$count = count( $chars );

	for ( $c = 0; $c < $count; $c++ ) {
		$ch = $chars[ $c ];

		if ( '{' === $ch ) {
			// Versuche, eine {n}-Sequenz zu lesen.
			$num = '';
			$j   = $c + 1;
			while ( $j < $count && ctype_digit( $chars[ $j ] ) ) {
				$num .= $chars[ $j ];
				$j++;
			}

			if ( '' !== $num && $j < $count && '}' === $chars[ $j ] ) {
				$n = (int) $num;
				if ( $n >= 1 && $n <= 15 ) {
					$stellen[] = array(
						'type'  => 'color',
						'value' => (string) $n,
					);
					$c = $j; // Hinter die schliessende Klammer springen.
					continue;
				}
			}

			// Kein gültiger Farbflap: die '{' wird als Leer-Klappe behandelt,
			// der Rest der vermeintlichen Sequenz läuft normal weiter durch.
			// Geschweifte Klammern selbst sind keine darstellbaren Zeichen → Leer.
			$stellen[] = array(
				'type'  => 'char',
				'value' => ' ',
			);
			continue;
		}

		$stellen[] = array(
			'type'  => 'char',
			'value' => split_flap_normalize_char( $ch, $grossschrift ),
		);
	}

	unset( $len, $i );

	return $stellen;
}

/**
 * Normalisiert ein Einzelzeichen auf den erlaubten Zeichensatz (A–Z, 0–9, Leer).
 *
 * Zeichen ausserhalb des Satzes werden zu Leerzeichen (Leer-Klappe), kein Fehler.
 *
 * @param string $ch          Einzelzeichen.
 * @param bool   $grossschrift Wandelt Buchstaben in Grossbuchstaben.
 * @return string Ein Zeichen aus A–Z, 0–9 oder ' '.
 */
function split_flap_normalize_char( $ch, $grossschrift ) {
	if ( $grossschrift ) {
		$ch = function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $ch, 'UTF-8' ) : strtoupper( $ch );
	}

	// Erlaubt sind A–Z, 0–9 und Leerzeichen. Alles andere wird zur Leer-Klappe.
	if ( preg_match( '/^[A-Z0-9]$/', $ch ) ) {
		return $ch;
	}

	return ' ';
}

/**
 * Baut die Stellen einer Board-Zeile auf genau $stellen_anzahl auf.
 *
 * Auffüllen und Kürzen pro Zeile (Spezifikation v2 Abschnitt 2):
 *  - Zeile kürzer → rechts mit Leer-Klappen auffüllen.
 *  - Zeile länger → auf $stellen_anzahl kürzen.
 *
 * @param string $zeile          Roh-Zeile.
 * @param int    $stellen_anzahl Anzahl Stellen pro Zeile.
 * @param bool   $grossschrift   Grossschreibung erzwingen.
 * @return array<int, array{type:string, value:string}> Genau $stellen_anzahl Stellen.
 */
function split_flap_build_line( $zeile, $stellen_anzahl, $grossschrift ) {
	$stellen = split_flap_parse_line( (string) $zeile, $grossschrift );

	$stellen = array_slice( $stellen, 0, $stellen_anzahl );
	while ( count( $stellen ) < $stellen_anzahl ) {
		$stellen[] = array(
			'type'  => 'char',
			'value' => ' ',
		);
	}

	return $stellen;
}

/**
 * Baut eine ganze Szene (Board-Inhalt) als 2D-Raster aus Stellen.
 *
 * Jede Eingabezeile (getrennt durch \n) ist eine Board-Zeile. Überzählige
 * Eingabezeilen werden verworfen, fehlende Zeilen bleiben leer.
 *
 * @param string $szene_text     Roh-Text einer Szene (Zeilen durch \n getrennt).
 * @param int    $zeilen         Anzahl Board-Zeilen.
 * @param int    $stellen_anzahl Anzahl Stellen pro Zeile.
 * @param bool   $grossschrift   Grossschreibung erzwingen.
 * @return array<int, array<int, array{type:string, value:string}>> Raster [Zeile][Stelle].
 */
function split_flap_build_scene( $szene_text, $zeilen, $stellen_anzahl, $grossschrift ) {
	$szene_text = (string) $szene_text;
	$roh_zeilen = preg_split( '/\r\n|\r|\n/', $szene_text );
	if ( false === $roh_zeilen ) {
		$roh_zeilen = array();
	}

	$roh_zeilen = array_slice( $roh_zeilen, 0, $zeilen );

	$raster = array();
	for ( $z = 0; $z < $zeilen; $z++ ) {
		$zeile        = isset( $roh_zeilen[ $z ] ) ? $roh_zeilen[ $z ] : '';
		$raster[ $z ] = split_flap_build_line( $zeile, $stellen_anzahl, $grossschrift );
	}

	return $raster;
}

/**
 * Erzeugt aus einem Stellen-Raster den vorlesbaren Text (Screenreader).
 *
 * Farbflaps werden übersprungen (sie tragen keine Information). Mehrere Zeilen
 * werden mit einem Zeilenumbruch verbunden, überflüssige Leerzeichen getrimmt.
 *
 * @param array<int, array<int, array{type:string, value:string}>> $raster Stellen-Raster.
 * @return string Vorlesbarer Text.
 */
function split_flap_scene_to_text( $raster ) {
	$zeilen = array();
	foreach ( $raster as $stellen ) {
		$buf = '';
		foreach ( $stellen as $stelle ) {
			$buf .= ( 'char' === $stelle['type'] ) ? $stelle['value'] : ' ';
		}
		$buf = rtrim( $buf );
		if ( '' !== $buf ) {
			$zeilen[] = $buf;
		}
	}

	return implode( "\n", $zeilen );
}

/**
 * Normalisiert und validiert die Board-Argumente (aus Block oder Shortcode).
 *
 * @param array<string, mixed> $args Roh-Eingaben.
 * @return array{
 *   szenen: array<int, string>,
 *   zeilen: int,
 *   stellen: int,
 *   intervall: int,
 *   tempo: string,
 *   farben: array<int, string>,
 *   grossschrift: bool,
 *   textfarbe: string,
 *   klappenfarbe: string,
 *   schrift: string
 * } Bereinigte Werte.
 */
function split_flap_sanitize_board_args( $args ) {
	$allowed = split_flap_allowed_values();

	// Szenen: Liste roher Szenen-Texte. Jede Szene ist ein vollständiger Board-Inhalt.
	$szenen_roh = isset( $args['szenen'] ) && is_array( $args['szenen'] ) ? $args['szenen'] : array();
	$szenen     = array();
	foreach ( $szenen_roh as $szene ) {
		// Mehrzeiliger Text: Tags entfernen, aber Zeilenumbrüche bewahren.
		$szene    = is_string( $szene ) ? $szene : '';
		$szene    = wp_strip_all_tags( $szene );
		$szenen[] = $szene;
	}
	if ( empty( $szenen ) ) {
		$szenen = array( '' );
	}

	$zeilen = isset( $args['zeilen'] ) ? (int) $args['zeilen'] : 6;
	if ( $zeilen < 1 ) {
		$zeilen = 1;
	}
	if ( $zeilen > 30 ) {
		$zeilen = 30; // Harte Obergrenze gegen Riesen-Boards.
	}

	$stellen = isset( $args['stellen'] ) ? (int) $args['stellen'] : 25;
	if ( $stellen < 1 ) {
		$stellen = 1;
	}
	if ( $stellen > 60 ) {
		$stellen = 60;
	}

	$intervall = isset( $args['intervall'] ) ? (int) $args['intervall'] : 6;
	if ( $intervall < 2 ) {
		$intervall = 2;
	}
	if ( $intervall > 30 ) {
		$intervall = 30;
	}

	$tempo = ( isset( $args['tempo'] ) && in_array( $args['tempo'], $allowed['tempo'], true ) ) ? $args['tempo'] : 'normal';

	$schrift = ( isset( $args['schrift'] ) && in_array( $args['schrift'], $allowed['schrift'], true ) ) ? $args['schrift'] : 'mono';

	$gross = isset( $args['grossschrift'] )
		? filter_var( $args['grossschrift'], FILTER_VALIDATE_BOOLEAN )
		: true;

	$farben = split_flap_sanitize_palette( isset( $args['farben'] ) ? $args['farben'] : null );

	$textfarbe    = split_flap_sanitize_color( isset( $args['textfarbe'] ) ? $args['textfarbe'] : '', '#C8C8C8' );
	$klappenfarbe = split_flap_sanitize_color( isset( $args['klappenfarbe'] ) ? $args['klappenfarbe'] : '', '#1A1A1A' );

	// Block-Ausrichtung (Gutenberg-align). Nur erlaubte Werte; alles andere = keine
	// Ausrichtung. Die align-Klasse muss bei render_callback-Blöcken aktiv auf den
	// Container gesetzt werden, sonst greift das align-CSS im Frontend nicht.
	$align        = isset( $args['align'] ) && is_string( $args['align'] ) ? $args['align'] : '';
	$align_erlaubt = array( 'left', 'center', 'right', 'wide', 'full' );
	$align        = in_array( $align, $align_erlaubt, true ) ? $align : '';

	return array(
		'szenen'       => $szenen,
		'zeilen'       => $zeilen,
		'stellen'      => $stellen,
		'intervall'    => $intervall,
		'tempo'        => $tempo,
		'farben'       => $farben,
		'grossschrift' => $gross,
		'textfarbe'    => $textfarbe,
		'klappenfarbe' => $klappenfarbe,
		'schrift'      => $schrift,
		'align'        => $align,
	);
}

/**
 * Baut das HTML-Markup eines Split-Flap-Boards.
 *
 * Diese Funktion ist die einzige Render-Quelle für das mehrzeilige Board (Block
 * und Shortcode). Sie gibt fertiges, vollständig escaptes HTML zurück.
 *
 * @param array<string, mixed> $args Roh-Eingaben aus Block oder Shortcode.
 * @return string HTML-Markup.
 */
function split_flap_render_board( $args ) {
	$o = split_flap_sanitize_board_args( $args );

	// Jede Szene als Stellen-Raster aufbauen.
	$szenen_raster = array();
	foreach ( $o['szenen'] as $szene_text ) {
		$szenen_raster[] = split_flap_build_scene( $szene_text, $o['zeilen'], $o['stellen'], $o['grossschrift'] );
	}

	$tempo_dauer = array(
		'langsam' => 90,
		'normal'  => 55,
		'schnell' => 30,
	);
	$flip_ms = isset( $tempo_dauer[ $o['tempo'] ] ) ? $tempo_dauer[ $o['tempo'] ] : $tempo_dauer['normal'];

	$schrift_class = 'theme' === $o['schrift'] ? 'split-flap--font-theme' : 'split-flap--font-mono';

	// align-Klasse für den Container. Gutenberg benennt sie «align» + Wert
	// (alignwide, alignfull, aligncenter …). Bei render_callback-Blöcken hängt
	// WordPress sie nicht automatisch an – wir setzen sie selbst, damit das
	// align-CSS (.split-flap.alignfull usw.) im Frontend greift.
	$align_class = '' !== $o['align'] ? ' align' . $o['align'] : '';

	// Custom Properties für Farben und Tempo. Farbflaps liegen als --sf-color-N vor.
	// --sf-stellen speist die Container-Query-Breite (Klappen passen in den Container).
	$style = sprintf(
		'--sf-text:%1$s;--sf-flap:%2$s;--sf-flip-ms:%3$dms;--sf-stellen:%4$d;',
		esc_attr( $o['textfarbe'] ),
		esc_attr( $o['klappenfarbe'] ),
		(int) $flip_ms,
		(int) $o['stellen']
	);
	for ( $i = 0; $i < 15; $i++ ) {
		$style .= sprintf( '--sf-color-%1$d:%2$s;', $i + 1, esc_attr( $o['farben'][ $i ] ) );
	}

	$charset = split_flap_charset( 'alnum' );

	// Erste Szene ist der initial sichtbare Zustand (Aufbau-Animation startet hier).
	$erste = $szenen_raster[0];

	$sr_text = split_flap_scene_to_text( $erste );

	$out  = '<div class="split-flap split-flap--board ' . esc_attr( $schrift_class ) . esc_attr( $align_class ) . '"';
	$out .= ' style="' . esc_attr( $style ) . '"';
	$out .= ' data-sf-charset="' . esc_attr( $charset ) . '"';
	$out .= ' data-sf-intervall="' . esc_attr( (int) $o['intervall'] ) . '"';
	$out .= ' data-sf-szenen="' . esc_attr( (int) count( $szenen_raster ) ) . '"';
	$out .= ' data-sf-zeilen="' . esc_attr( (int) $o['zeilen'] ) . '"';
	$out .= ' data-sf-stellen="' . esc_attr( (int) $o['stellen'] ) . '">';

	// Ton-Toggle: echtes <button>, Default «aus». Erst die erste Nutzergeste
	// entsperrt den AudioContext (siehe split-flap.js).
	$out .= '<button type="button" class="split-flap__sound" aria-pressed="false"';
	$out .= ' data-sf-sound-on="' . esc_attr__( 'Ton ausschalten', 'split-flap' ) . '"';
	$out .= ' data-sf-sound-off="' . esc_attr__( 'Ton einschalten', 'split-flap' ) . '"';
	$out .= ' aria-label="' . esc_attr__( 'Ton einschalten', 'split-flap' ) . '">';
	$out .= '<span class="split-flap__sound-icon" aria-hidden="true"></span>';
	$out .= '</button>';

	// Screenreader-Text: zusammenhängender String der ersten Szene, visuell versteckt.
	$out .= '<span class="split-flap__sr">' . esc_html( $sr_text ) . '</span>';

	// Sichtbares Board – dekorativ, daher aria-hidden.
	$out .= '<div class="split-flap__rows" aria-hidden="true">';

	foreach ( $erste as $stellen ) {
		$out .= '<div class="split-flap__row">';
		foreach ( $stellen as $stelle ) {
			$out .= split_flap_render_cell( $stelle );
		}
		$out .= '</div>';
	}

	$out .= '</div>'; // .split-flap__rows

	// Alle Szenen als JSON-Datenblock für das JS (entkoppelt von Animation/Sound).
	// json_encode liefert reine Strings/Zahlen; das Ergebnis wird zusätzlich für
	// die Ausgabe in einem Script-Tag escaped.
	$szenen_payload = array();
	foreach ( $szenen_raster as $raster ) {
		$scene_rows = array();
		foreach ( $raster as $stellen ) {
			$row = array();
			foreach ( $stellen as $stelle ) {
				$row[] = ( 'color' === $stelle['type'] )
					? 'c' . $stelle['value']           // Farbflap: c1 … c15.
					: $stelle['value'];                // Zeichen oder Leerzeichen.
			}
			$scene_rows[] = $row;
		}
		$szenen_payload[] = $scene_rows;
	}

	$json = wp_json_encode( $szenen_payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
	if ( false === $json ) {
		$json = '[]';
	}
	// Mit JSON_HEX_TAG enthält die Ausgabe weder '<' noch '>' wörtlich; ein
	// </script> kann den Block also nicht vorzeitig schliessen. Zusätzlicher
	// Gürtel-und-Hosenträger-Schutz für '<' bleibt unschädlich.
	$json = str_replace( '<', '<', $json );

	$out .= '<script type="application/json" class="split-flap__data">' . $json . '</script>';

	$out .= '</div>'; // .split-flap

	return $out;
}

/**
 * Rendert eine einzelne Klappe (Zeichen- oder Farbflap-Stelle).
 *
 * @param array{type:string, value:string} $stelle Stelle.
 * @return string HTML einer Klappe.
 */
function split_flap_render_cell( $stelle ) {
	if ( 'color' === $stelle['type'] ) {
		$n          = (int) $stelle['value'];
		$cell_class = 'split-flap__cell split-flap__cell--color';
		$style      = 'background:var(--sf-color-' . $n . ');';

		$out  = '<span class="' . esc_attr( $cell_class ) . '"';
		$out .= ' data-sf-target="c' . esc_attr( (string) $n ) . '"';
		$out .= ' style="' . esc_attr( $style ) . '">';
		$out .= '<span class="split-flap__char"></span>';
		$out .= '</span>';

		return $out;
	}

	$char       = $stelle['value'];
	$is_space   = ( ' ' === $char || '' === $char );
	$cell_class = 'split-flap__cell' . ( $is_space ? ' split-flap__cell--space' : '' );

	$out  = '<span class="' . esc_attr( $cell_class ) . '" data-sf-target="' . esc_attr( $char ) . '">';
	$out .= '<span class="split-flap__char">' . esc_html( $is_space ? '' : $char ) . '</span>';
	$out .= '</span>';

	return $out;
}

/**
 * v1-Render: einzeilige Anzeige als Sonderfall des Boards (eine Zeile, eine Szene).
 *
 * Hält die Rückwärtskompatibilität: derselbe Aufruf wie in v1, intern auf das
 * Board-Modell abgebildet. Felder/Zeichenzahl steuert die Stellen pro Zeile.
 *
 * @param array<string, mixed> $args Roh-Eingaben (v1-Schema).
 * @return string HTML-Markup.
 */
function split_flap_render( $args ) {
	$defaults = split_flap_defaults();

	$text = isset( $args['text'] ) ? (string) $args['text'] : $defaults['text'];
	$text = sanitize_text_field( wp_strip_all_tags( $text ) );

	$gross = isset( $args['grossschrift'] )
		? filter_var( $args['grossschrift'], FILTER_VALIDATE_BOOLEAN )
		: $defaults['grossschrift'];

	$felder = isset( $args['felder'] ) ? (int) $args['felder'] : $defaults['felder'];
	if ( $felder < 0 ) {
		$felder = 0;
	}
	if ( $felder > 60 ) {
		$felder = 60;
	}
	if ( 0 === $felder ) {
		$laenge = count( split_flap_chars( $text ) );
		$felder = max( 1, $laenge );
	}

	// v1 kannte keine Farbflaps; geschweifte Klammern sollen hier neutral wirken.
	// Da split_flap_parse_line {n} nur für 1–15 als Farbe deutet und sonst zu
	// Leer-Klappen, bleibt reiner Text unverändert.
	$board_args = array(
		'szenen'       => array( $text ),
		'zeilen'       => 1,
		'stellen'      => $felder,
		'intervall'    => 6,
		'tempo'        => isset( $args['tempo'] ) ? $args['tempo'] : $defaults['tempo'],
		'farben'       => null,
		'grossschrift' => $gross,
		'textfarbe'    => isset( $args['textfarbe'] ) ? $args['textfarbe'] : $defaults['textfarbe'],
		'klappenfarbe' => isset( $args['klappenfarbe'] ) ? $args['klappenfarbe'] : $defaults['klappenfarbe'],
		'schrift'      => isset( $args['schrift'] ) ? $args['schrift'] : $defaults['schrift'],
		'align'        => isset( $args['align'] ) ? $args['align'] : '',
	);

	return split_flap_render_board( $board_args );
}
