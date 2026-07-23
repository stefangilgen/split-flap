<?php
/**
 * Mini-Selbstcheck der Server-Validierung – ohne Framework, ohne WordPress.
 *
 * Aufruf: php tests/sanitize-check.php
 * Exit-Code 0 = alles gut, 1 = mindestens eine Prüfung verletzt.
 *
 * Prüft die Whitelist-Validierung der v0.5.0-Attribute (zeichen, start,
 * rahmenfarbe) und die neuen Defaults. Schlägt fehl, sobald die Logik in
 * includes/render.php bricht.
 *
 * @package Split_Flap
 */

// ABSPATH-Guard von render.php passieren; minimale WP-Stubs für die
// tatsächlich durchlaufenen Funktionen.
define( 'ABSPATH', __DIR__ );

/**
 * Stub von sanitize_hex_color(): #rgb oder #rrggbb, sonst null.
 *
 * @param string $color Roh-Eingabe.
 * @return string|null Hex oder null.
 */
function sanitize_hex_color( $color ) {
	return preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', (string) $color ) ? $color : null;
}

require __DIR__ . '/../includes/render.php';

$fehler = 0;

/**
 * Eine Prüfung: meldet PASS/FAIL und zählt Fehler.
 *
 * @param string $name Prüfname.
 * @param bool   $ok   Ergebnis.
 * @return void
 */
function pruefe( $name, $ok ) {
	global $fehler;
	echo ( $ok ? 'PASS' : 'FAIL' ) . ' – ' . $name . "\n";
	if ( ! $ok ) {
		$fehler++;
	}
}

// Defaults (leere Eingabe).
$o = split_flap_sanitize_board_args( array() );
pruefe( 'Default zeilen ist 1', 1 === $o['zeilen'] );
pruefe( 'Default zeichen ist alnum', 'alnum' === $o['zeichen'] );
pruefe( 'Default start ist zufall', 'zufall' === $o['start'] );
pruefe( 'Default rahmenfarbe ist #303030', '#303030' === $o['rahmenfarbe'] );

// Gültige Werte kommen durch.
$o = split_flap_sanitize_board_args(
	array(
		'zeichen'     => 'zahlen',
		'start'       => 'alpha',
		'rahmenfarbe' => '#7C2D12',
	)
);
pruefe( 'zeichen=zahlen kommt durch', 'zahlen' === $o['zeichen'] );
pruefe( 'start=alpha kommt durch', 'alpha' === $o['start'] );
pruefe( 'rahmenfarbe #7C2D12 kommt durch', '#7C2D12' === $o['rahmenfarbe'] );

// Ungültige Werte fallen auf die Defaults zurück.
$o = split_flap_sanitize_board_args(
	array(
		'zeichen'     => '<script>alert(1)</script>',
		'start'       => 'leer', // Seit 0.5.0 nicht mehr in der Whitelist.
		'rahmenfarbe' => 'red',
	)
);
pruefe( 'ungültiger zeichen-Wert fällt auf alnum zurück', 'alnum' === $o['zeichen'] );
pruefe( 'start=leer fällt auf zufall zurück', 'zufall' === $o['start'] );
pruefe( 'ungültige rahmenfarbe fällt auf #303030 zurück', '#303030' === $o['rahmenfarbe'] );

// Zeichensatz-Ableitung, die data-sf-charset speist.
pruefe( 'split_flap_charset(zahlen) liefert nur Ziffern', '0123456789' === split_flap_charset( 'zahlen' ) );
pruefe( 'split_flap_charset(unbekannt) fällt auf alnum zurück', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' === split_flap_charset( 'xxx' ) );

// Start-Whitelist enthält genau die zwei angebotenen Werte.
$allowed = split_flap_allowed_values();
pruefe( 'start-Whitelist ist exakt [zufall, alpha]', array( 'zufall', 'alpha' ) === $allowed['start'] );

exit( $fehler > 0 ? 1 : 0 );
