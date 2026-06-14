/**
 * Split-Flap – Frontend-Animation (Vanilla JS, keine Abhängigkeiten).
 *
 * Ablauf:
 *  1. IntersectionObserver startet jede Anzeige erst, wenn sie sichtbar wird.
 *  2. Jede Klappe rattert vom Startzustand (Zufall / leer / alphabetisch) zum
 *     Zielzeichen. Klappen stoppen versetzt von links nach rechts.
 *  3. Bei prefers-reduced-motion zeigt das Skript sofort den statischen Zieltext.
 *
 * Die Animation läuft über CSS-Transforms (rotateX in split-flap.css). Dieses
 * Skript steuert nur, welches Zeichen je Schritt anliegt und wann gestoppt wird.
 */
( function () {
	'use strict';

	var REDUCED = window.matchMedia && window.matchMedia( '( prefers-reduced-motion: reduce )' ).matches;

	// Reihenfolge der Zwischenzeichen beim alphabetischen Rattern.
	var ALPHA_SEQUENCE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	/**
	 * Liefert eine zufällige Glyphe aus dem Charset der Anzeige.
	 *
	 * @param {string} charset Erlaubte Zeichen.
	 * @return {string} Ein Zeichen.
	 */
	function randomGlyph( charset ) {
		if ( ! charset ) {
			return ' ';
		}
		var chars = Array.from( charset );
		return chars[ Math.floor( Math.random() * chars.length ) ];
	}

	/**
	 * Bestimmt das Startzeichen je nach Startverhalten.
	 *
	 * @param {string} startMode zufall | leer | alpha.
	 * @param {string} charset   Erlaubte Zeichen.
	 * @return {string} Startglyphe.
	 */
	function startGlyph( startMode, charset ) {
		if ( 'leer' === startMode ) {
			return ' ';
		}
		if ( 'alpha' === startMode ) {
			return ALPHA_SEQUENCE.charAt( 0 );
		}
		return randomGlyph( charset );
	}

	/**
	 * Baut die beiden Flip-Hälften in eine Klappe ein (einmalig).
	 *
	 * @param {HTMLElement} cell Die Klappe.
	 * @return {{top: HTMLElement, bottom: HTMLElement, topGlyph: HTMLElement, bottomGlyph: HTMLElement}} Referenzen.
	 */
	function buildHalves( cell ) {
		var top = document.createElement( 'span' );
		top.className = 'sf-flip-top';
		var topGlyph = document.createElement( 'span' );
		topGlyph.className = 'sf-glyph';
		top.appendChild( topGlyph );

		var bottom = document.createElement( 'span' );
		bottom.className = 'sf-flip-bottom';
		var bottomGlyph = document.createElement( 'span' );
		bottomGlyph.className = 'sf-glyph';
		bottom.appendChild( bottomGlyph );

		cell.appendChild( top );
		cell.appendChild( bottom );

		return { top: top, bottom: bottom, topGlyph: topGlyph, bottomGlyph: bottomGlyph };
	}

	/**
	 * Setzt das statische Zielzeichen einer Klappe (ohne Animation).
	 *
	 * @param {HTMLElement} cell   Die Klappe.
	 * @param {string}      target Zielzeichen.
	 * @return {void}
	 */
	function setStatic( cell, target ) {
		var glyph = cell.querySelector( '.split-flap__char' );
		if ( glyph ) {
			glyph.textContent = ' ' === target ? '' : target;
		}
	}

	/**
	 * Animiert eine einzelne Klappe bis zum Zielzeichen.
	 *
	 * @param {HTMLElement} cell    Klappe.
	 * @param {Object}      config  { charset, startMode, flipMs }.
	 * @param {number}      delay   Startverzögerung in ms (für Links-nach-rechts-Versatz).
	 * @return {void}
	 */
	function animateCell( cell, config, delay ) {
		var target = cell.getAttribute( 'data-sf-target' );
		if ( null === target ) {
			target = ' ';
		}

		var halves = buildHalves( cell );
		var current = startGlyph( config.startMode, config.charset );

		// Sichtbares Zeichen während des Laufs ausblenden, Hälften übernehmen.
		cell.classList.add( 'is-flipping' );
		halves.topGlyph.textContent = current;
		halves.bottomGlyph.textContent = current;

		// Anzahl Zwischenschritte: ein paar Umdrehungen, bevor das Ziel kommt.
		var steps = 4 + Math.floor( Math.random() * 6 );

		var step = 0;

		function doFlip() {
			var next;
			if ( step >= steps - 1 ) {
				next = target; // Letzter Schritt landet exakt auf dem Ziel.
			} else if ( 'alpha' === config.startMode ) {
				var idx = ( ALPHA_SEQUENCE.indexOf( current ) + 1 ) % ALPHA_SEQUENCE.length;
				next = ALPHA_SEQUENCE.charAt( idx );
			} else {
				next = randomGlyph( config.charset );
			}

			// Obere Hälfte zeigt das alte Zeichen und klappt weg.
			halves.topGlyph.textContent = ' ' === current ? '' : current;
			// Untere Hälfte zeigt das neue Zeichen und klappt nach.
			halves.bottomGlyph.textContent = ' ' === next ? '' : next;

			// Animation neu auslösen: Klasse entfernen, Reflow, wieder setzen.
			halves.top.classList.remove( 'sf-anim' );
			halves.bottom.classList.remove( 'sf-anim' );
			// Reflow erzwingen, damit die Animation erneut startet.
			void halves.top.offsetWidth;
			halves.top.classList.add( 'sf-anim' );
			halves.bottom.classList.add( 'sf-anim' );

			current = next;
			step++;

			if ( step < steps ) {
				window.setTimeout( doFlip, config.flipMs );
			} else {
				// Fertig: statisches Zielzeichen einsetzen, Hälften entfernen.
				window.setTimeout( function () {
					setStatic( cell, target );
					cell.classList.remove( 'is-flipping' );
					if ( halves.top.parentNode ) {
						cell.removeChild( halves.top );
					}
					if ( halves.bottom.parentNode ) {
						cell.removeChild( halves.bottom );
					}
				}, config.flipMs );
			}
		}

		window.setTimeout( doFlip, delay );
	}

	/**
	 * Startet die Animation einer kompletten Anzeige.
	 *
	 * @param {HTMLElement} board Element mit Klasse .split-flap.
	 * @return {void}
	 */
	function runBoard( board ) {
		if ( board.getAttribute( 'data-sf-done' ) ) {
			return;
		}
		board.setAttribute( 'data-sf-done', '1' );

		var cells = board.querySelectorAll( '.split-flap__cell' );

		if ( REDUCED ) {
			// Sofort statischer Zieltext, keine Animation.
			cells.forEach( function ( cell ) {
				setStatic( cell, cell.getAttribute( 'data-sf-target' ) || ' ' );
			} );
			return;
		}

		var styles = window.getComputedStyle( board );
		var flipMs = parseInt( styles.getPropertyValue( '--sf-flip-ms' ), 10 ) || 55;

		var config = {
			charset: board.getAttribute( 'data-sf-charset' ) || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
			startMode: board.getAttribute( 'data-sf-start' ) || 'zufall',
			flipMs: flipMs
		};

		// Versetzter Start von links nach rechts.
		var stagger = Math.max( 60, flipMs * 1.6 );
		cells.forEach( function ( cell, i ) {
			animateCell( cell, config, i * stagger );
		} );
	}

	/**
	 * Initialisiert alle Anzeigen auf der Seite.
	 *
	 * @return {void}
	 */
	function init() {
		var boards = document.querySelectorAll( '.split-flap:not(.split-flap--editor)' );
		if ( ! boards.length ) {
			return;
		}

		if ( ! ( 'IntersectionObserver' in window ) ) {
			// Fallback ohne Observer: alle direkt starten.
			boards.forEach( runBoard );
			return;
		}

		var observer = new IntersectionObserver(
			function ( entries, obs ) {
				entries.forEach( function ( entry ) {
					if ( entry.isIntersecting ) {
						runBoard( entry.target );
						obs.unobserve( entry.target );
					}
				} );
			},
			{ threshold: 0.25 }
		);

		boards.forEach( function ( board ) {
			observer.observe( board );
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
