/**
 * Split-Flap – Frontend-Engine (Vanilla JS, keine Abhängigkeiten).
 *
 * Aufgaben:
 *  1. IntersectionObserver startet jedes Board erst, wenn es sichtbar wird, und
 *     steuert den Szenen-Loop (pausiert ausserhalb des Viewports).
 *  2. Jede Stelle rattert vom alten zum neuen Inhalt.
 *  3. Szenen wechseln automatisch im konfigurierten Intervall (Loop).
 *  4. Jeder Wechsel feuert ein Custom-Event «splitflap:flip» am Board-Element
 *     (saubere Erweiterungsstelle für Drittcode; das Plugin selbst hört nicht zu).
 *  5. Animationsstil: «sequenziell» (versetzt, nur geänderte Stellen) oder
 *     «synchron» (alle Klappen starten gleichzeitig bei Farbe 1 und laufen durch
 *     den vollständigen Farb-/Zeichen-Ring).
 *  6. prefers-reduced-motion: reduce → nur erste Szene statisch, kein Loop.
 */
( function () {
	'use strict';

	var REDUCED = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	// Vollständiger Zeichen-Teil des Rings (48 Positionen): A–Z, 0–9, Leer an
	// Position 37, dann die elf Sonderzeichen in fester Reihenfolge.
	var ALPHA_SEQUENCE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +-.,–%&*?!/';

	// Die 15 Farbflaps in Index-Reihenfolge (c1 … c15) – Anfang des Modus-B-Rings.
	var COLOR_RING = [
		'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
		'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15'
	];

	// Vollständiger Modus-B-Ring: zuerst 15 Farben, dann 48 Zeichen-Positionen.
	// Ringlänge = 63. Jede Klappe läuft ihn genau einmal und stoppt auf dem Ziel.
	var SYNC_RING = COLOR_RING.concat( Array.from( ALPHA_SEQUENCE ) );

	// Obergrenze des Modus-B-Ticks (ms). Der längste Durchlauf (Ziel «/», Position
	// 63) bei «normal» soll ≤ 2.5 s bleiben: 2500 / 63 ≈ 39 ms.
	var SYNC_TICK_CAP_MS = 39;

	// Höchstzahl Zwischenschritte pro Klappe. Deterministische Obergrenze, damit
	// die längste mögliche Animationsdauer im Voraus berechenbar ist (Aufgabe 1).
	var MAX_STEPS = 7;

	// Ruhepuffer nach Abschluss eines Wechsels, bevor der nächste starten darf.
	// Das garantiert ein sichtbares, scharfes Board zwischen den Wechseln.
	var REST_MS = 800;

	/* ------------------------------------------------------------------ *
	 * Full-Bleed: echte Viewport-Breite für .alignfull, scrollbar-sicher.
	 *
	 * Das CSS spannt .split-flap.alignfull auf var(--sf-vw, 100vw). Reine CSS-
	 * 100vw schliesst die vertikale Scrollbar mit ein und erzeugt damit auf
	 * Desktops mit klassischer Scrollbar einen horizontalen Überlauf. Hier
	 * messen wir document.documentElement.clientWidth – das ist die Innenbreite
	 * OHNE Scrollbar – und legen sie als globale Variable --sf-vw ab. Damit ist
	 * die Tafel exakt so breit wie der sichtbare Bereich, nie breiter.
	 *
	 * Läuft nur, wenn überhaupt ein alignfull-Board existiert. Resize-Updates
	 * sind per requestAnimationFrame entprellt.
	 * ------------------------------------------------------------------ */
	var FullBleed = ( function () {
		var active = false;
		var rafId = 0;

		function apply() {
			rafId = 0;
			var w = document.documentElement.clientWidth;
			if ( w > 0 ) {
				document.documentElement.style.setProperty( '--sf-vw', w + 'px' );
			}
		}

		function schedule() {
			if ( rafId ) {
				return;
			}
			rafId = window.requestAnimationFrame
				? window.requestAnimationFrame( apply )
				: window.setTimeout( apply, 16 );
		}

		function init() {
			if ( active ) {
				return;
			}
			if ( ! document.querySelector( '.split-flap.alignfull:not(.split-flap--editor)' ) ) {
				return;
			}
			active = true;
			apply();
			window.addEventListener( 'resize', schedule );
			window.addEventListener( 'orientationchange', schedule );
		}

		return { init: init };
	} )();

	/* ------------------------------------------------------------------ *
	 * Hilfsfunktionen.
	 * ------------------------------------------------------------------ */

	/**
	 * Zufällige Glyphe aus dem Charset.
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
	 * Liest die Szenen-Daten aus dem eingebetteten JSON-Block.
	 *
	 * @param {HTMLElement} board Board-Element.
	 * @return {Array<Array<Array<string>>>} Szenen → Zeilen → Stellen (Tokens).
	 */
	function readScenes( board ) {
		var holder = board.querySelector( '.split-flap__data' );
		if ( ! holder ) {
			return [];
		}
		try {
			var parsed = JSON.parse( holder.textContent );
			return Array.isArray( parsed ) ? parsed : [];
		} catch ( e ) {
			return [];
		}
	}

	/**
	 * Prüft, ob ein Token ein Farbflap ist (c1 … c15).
	 *
	 * @param {string} token Stellen-Token.
	 * @return {boolean} true bei Farbflap.
	 */
	function isColorToken( token ) {
		return 'string' === typeof token && /^c([1-9]|1[0-5])$/.test( token );
	}

	/* ------------------------------------------------------------------ *
	 * Klappen-Animation einer einzelnen Stelle.
	 * ------------------------------------------------------------------ */

	/**
	 * Setzt eine Klappe statisch auf ein Zeichen (ohne Animation).
	 *
	 * @param {HTMLElement} cell  Klappe.
	 * @param {string}      token Ziel-Token (Zeichen, ' ' oder cN).
	 * @return {void}
	 */
	function setStatic( cell, token ) {
		applyTokenClasses( cell, token );
		var glyph = cell.querySelector( '.split-flap__char' );
		if ( glyph ) {
			glyph.textContent = isColorToken( token ) || ' ' === token ? '' : token;
		}
	}

	/**
	 * Setzt die Klassen/Inline-Farbe einer Klappe passend zum Token.
	 *
	 * @param {HTMLElement} cell  Klappe.
	 * @param {string}      token Ziel-Token.
	 * @return {void}
	 */
	function applyTokenClasses( cell, token ) {
		var isColor = isColorToken( token );
		var isSpace = ' ' === token || '' === token;

		cell.classList.toggle( 'split-flap__cell--color', isColor );
		cell.classList.toggle( 'split-flap__cell--space', ! isColor && isSpace );

		if ( isColor ) {
			var n = token.slice( 1 );
			cell.style.background = 'var(--sf-color-' + n + ')';
		} else {
			cell.style.background = '';
		}
	}

	/**
	 * Baut die beiden Flip-Hälften in eine Klappe ein (einmalig pro Flip).
	 *
	 * @param {HTMLElement} cell Klappe.
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
	 * Wandelt ein Token in den darstellbaren Glyph-Text (Farbflap → leer).
	 *
	 * @param {string} token Stellen-Token.
	 * @return {string} Anzeigetext.
	 */
	function glyphOf( token ) {
		if ( isColorToken( token ) || ' ' === token || '' === token ) {
			return '';
		}
		return token;
	}

	/**
	 * Bricht eine laufende Animation einer Klappe sauber ab.
	 *
	 * Stoppt alle vorgemerkten Timeouts der Klappe, entfernt sämtliche Flip-Hälften
	 * (auch übrig gebliebene aus früheren Läufen) und setzt den Flip-Zustand zurück.
	 * So schreibt nie ein zweiter Animationslauf auf dieselbe Klappe.
	 *
	 * @param {HTMLElement} cell Klappe.
	 * @return {void}
	 */
	function cancelCellAnimation( cell ) {
		var state = cell._sfAnim;
		if ( state && state.timers ) {
			for ( var t = 0; t < state.timers.length; t++ ) {
				window.clearTimeout( state.timers[ t ] );
			}
		}
		cell._sfAnim = null;

		// Alle Flip-Hälften entfernen – auch verwaiste aus parallelen Läufen.
		var stray = cell.querySelectorAll( '.sf-flip-top, .sf-flip-bottom' );
		for ( var i = 0; i < stray.length; i++ ) {
			cell.removeChild( stray[ i ] );
		}
		cell.classList.remove( 'is-flipping' );
	}

	/**
	 * Animiert eine einzelne Klappe vom aktuellen Inhalt zum Ziel-Token.
	 *
	 * @param {HTMLElement} cell    Klappe.
	 * @param {Object}      config  { charset, flipMs }.
	 * @param {string}      target  Ziel-Token.
	 * @param {number}      delay   Startverzögerung in ms.
	 * @param {Function}    onStep  Callback je sichtbarem Umklappen (für Sound).
	 * @return {void}
	 */
	function animateCell( cell, config, target, delay, onStep ) {
		// Laufende Animation derselben Klappe sauber abbrechen, bevor neue Hälften
		// gebaut werden. Verhindert DOM-Leak und parallele Schreibzugriffe.
		cancelCellAnimation( cell );

		var halves = buildHalves( cell );

		// Animationszustand pro Klappe merken (Timeout-Handles für sauberen Abbruch).
		var state = { timers: [] };
		cell._sfAnim = state;

		/**
		 * setTimeout, dessen Handle im Zustand der Klappe vermerkt wird.
		 *
		 * @param {Function} fn Rückruf.
		 * @param {number}   ms Verzögerung.
		 * @return {void}
		 */
		function schedule( fn, ms ) {
			var id = window.setTimeout( fn, ms );
			state.timers.push( id );
		}

		// Ausgangszeichen: was die Klappe aktuell zeigt.
		var startGlyph = cell.querySelector( '.split-flap__char' );
		var current = startGlyph ? startGlyph.textContent : '';
		if ( '' === current && cell.classList.contains( 'split-flap__cell--color' ) ) {
			current = ''; // Farbflap → leer als Ausgangswert.
		}

		cell.classList.add( 'is-flipping' );
		halves.topGlyph.textContent = current;
		halves.bottomGlyph.textContent = current;

		var targetGlyph = glyphOf( target );
		var targetIsColor = isColorToken( target );

		// Ein paar Zwischenschritte bis zum Ziel. Obergrenze MAX_STEPS, damit die
		// Dauer planbar bleibt (der Controller rechnet mit dem Worst Case).
		var steps = 3 + Math.floor( Math.random() * ( MAX_STEPS - 2 ) );
		var step = 0;

		function doFlip() {
			// Falls die Klappe inzwischen neu gestartet wurde, ist dieser Lauf veraltet.
			if ( cell._sfAnim !== state ) {
				return;
			}

			var next;
			if ( step >= steps - 1 ) {
				next = targetGlyph; // Letzter Schritt landet auf dem Ziel.
			} else {
				next = randomGlyph( config.charset );
			}

			halves.topGlyph.textContent = current;
			halves.bottomGlyph.textContent = next;

			// Bei Farbflap im letzten Schritt die Zielfarbe an die untere Hälfte legen.
			if ( step >= steps - 1 && targetIsColor ) {
				halves.bottom.style.background = 'var(--sf-color-' + target.slice( 1 ) + ')';
				halves.bottomGlyph.textContent = '';
			}

			halves.top.classList.remove( 'sf-anim' );
			halves.bottom.classList.remove( 'sf-anim' );
			void halves.top.offsetWidth; // Reflow erzwingt Neustart der Animation.
			halves.top.classList.add( 'sf-anim' );
			halves.bottom.classList.add( 'sf-anim' );

			if ( onStep ) {
				onStep();
			}

			current = next;
			step++;

			if ( step < steps ) {
				schedule( doFlip, config.flipMs );
			} else {
				schedule( function () {
					if ( cell._sfAnim !== state ) {
						return; // Veralteter Lauf – Cleanup macht der neue Lauf.
					}
					setStatic( cell, target );
					cell.classList.remove( 'is-flipping' );
					if ( halves.top.parentNode ) {
						cell.removeChild( halves.top );
					}
					if ( halves.bottom.parentNode ) {
						cell.removeChild( halves.bottom );
					}
					cell._sfAnim = null; // Klappe ruht: 0 Flip-Hälften.
				}, config.flipMs );
			}
		}

		schedule( doFlip, delay );
	}

	/**
	 * Position eines Ziel-Tokens im vollständigen Modus-B-Ring (SYNC_RING).
	 *
	 * @param {string} token Ziel-Token (cN, Zeichen oder ' ').
	 * @return {number} Index im Ring (0-basiert); SYNC_RING.length-1 als Fallback.
	 */
	function syncRingIndex( token ) {
		var t = ( ' ' === token || '' === token ) ? ' ' : token;
		var idx = SYNC_RING.indexOf( t );
		return idx >= 0 ? idx : SYNC_RING.length - 1;
	}

	/**
	 * Animiert eine Klappe im Modus B (synchron farbig).
	 *
	 * Alle Klappen starten gleichzeitig (delay = 0) bei Farbflap 1 und durchlaufen
	 * denselben Ring (c1…c15, dann 48 Zeichen) im selben Takt, Schritt für Schritt,
	 * bis sie ihr Zielzeichen erreichen. Dadurch zeigt das ganze Board zu jedem
	 * Tick dieselbe Ring-Position (farbige Welle); gestoppt wird gestaffelt nach
	 * Zielposition.
	 *
	 * @param {HTMLElement} cell   Klappe.
	 * @param {string}      target Ziel-Token.
	 * @param {number}      tickMs Takt je Ring-Schritt in ms.
	 * @return {void}
	 */
	function animateCellSync( cell, target, tickMs ) {
		cancelCellAnimation( cell );

		var halves = buildHalves( cell );
		var state = { timers: [] };
		cell._sfAnim = state;

		function schedule( fn, ms ) {
			var id = window.setTimeout( fn, ms );
			state.timers.push( id );
		}

		var stopIndex = syncRingIndex( target );

		// Ausgangswert: was die Klappe gerade zeigt (Text der ersten/alten Szene).
		var startGlyph = cell.querySelector( '.split-flap__char' );
		var current = startGlyph ? startGlyph.textContent : '';

		cell.classList.add( 'is-flipping' );
		halves.topGlyph.textContent = current;
		halves.bottomGlyph.textContent = current;

		var step = 0; // Ring-Position des nächsten anzuzeigenden Tokens.

		function tokenGlyph( token ) {
			return isColorToken( token ) || ' ' === token || '' === token ? '' : token;
		}

		function doTick() {
			if ( cell._sfAnim !== state ) {
				return;
			}

			var token = SYNC_RING[ step ];
			var isColor = isColorToken( token );

			halves.topGlyph.textContent = current;
			halves.bottomGlyph.textContent = tokenGlyph( token );

			if ( isColor ) {
				halves.bottom.style.background = 'var(--sf-color-' + token.slice( 1 ) + ')';
			} else {
				halves.bottom.style.background = '';
			}

			halves.top.classList.remove( 'sf-anim' );
			halves.bottom.classList.remove( 'sf-anim' );
			void halves.top.offsetWidth;
			halves.top.classList.add( 'sf-anim' );
			halves.bottom.classList.add( 'sf-anim' );

			current = tokenGlyph( token );
			var reachedTarget = step >= stopIndex;
			step++;

			if ( ! reachedTarget ) {
				schedule( doTick, tickMs );
			} else {
				schedule( function () {
					if ( cell._sfAnim !== state ) {
						return;
					}
					setStatic( cell, target );
					cell.classList.remove( 'is-flipping' );
					if ( halves.top.parentNode ) {
						cell.removeChild( halves.top );
					}
					if ( halves.bottom.parentNode ) {
						cell.removeChild( halves.bottom );
					}
					cell._sfAnim = null;
				}, tickMs );
			}
		}

		// Alle Klappen starten im selben Frame (delay 0) – synchroner Start.
		schedule( doTick, 0 );
	}

	/* ------------------------------------------------------------------ *
	 * Board-Controller: hält Szenen, steuert Wechsel und Loop.
	 * ------------------------------------------------------------------ */

	/**
	 * Erzeugt einen Controller für ein Board-Element.
	 *
	 * @param {HTMLElement} board Board-Element.
	 * @return {Object|null} Controller oder null, wenn ungültig.
	 */
	function createBoard( board ) {
		var scenes = readScenes( board );
		if ( ! scenes.length ) {
			return null;
		}

		var cells = Array.prototype.slice.call( board.querySelectorAll( '.split-flap__cell' ) );

		var styles = window.getComputedStyle( board );
		var flipMs = parseInt( styles.getPropertyValue( '--sf-flip-ms' ), 10 ) || 55;

		var config = {
			charset: board.getAttribute( 'data-sf-charset' ) || ALPHA_SEQUENCE,
			flipMs: flipMs
		};

		// Animationsstil: «synchron» (Modus B) oder «sequenziell» (Default, Modus A).
		var stil = board.getAttribute( 'data-sf-stil' ) === 'synchron' ? 'synchron' : 'sequenziell';

		// Modus-B-Tick: gedeckelt, damit der längste Ring-Durchlauf (63 Schritte)
		// bei «normal» ≤ 2.5 s bleibt.
		var syncTickMs = Math.min( flipMs, SYNC_TICK_CAP_MS );

		var intervalSec = parseInt( board.getAttribute( 'data-sf-intervall' ), 10 ) || 6;

		// Aktuelle Token je Stelle (flach, in DOM-Reihenfolge der Zellen).
		var currentTokens = flattenScene( scenes[ 0 ] );

		var sceneIndex = 0;
		var loopTimer = null;
		var started = false;
		// Dauer des Erstaufbaus; dient als Ruhebasis für den ersten geplanten Wechsel.
		var firstBuildDurationMs = 0;

		/**
		 * Flacht eine Szene (Zeilen → Stellen) in eine flache Token-Liste ab,
		 * passend zur DOM-Reihenfolge der Zellen.
		 *
		 * @param {Array<Array<string>>} scene Szene.
		 * @return {Array<string>} Flache Token-Liste.
		 */
		function flattenScene( scene ) {
			var flat = [];
			for ( var r = 0; r < scene.length; r++ ) {
				for ( var c = 0; c < scene[ r ].length; c++ ) {
					flat.push( scene[ r ][ c ] );
				}
			}
			return flat;
		}

		/**
		 * Berechnet die längste mögliche Animationsdauer eines Wechsels in ms.
		 *
		 * Die letzte umklappende Klappe startet nach «changed * stagger» und braucht
		 * dann im Worst Case (MAX_STEPS + 1) volle Flip-Phasen. Daraus ergibt sich
		 * die deterministische Obergrenze der Wechseldauer.
		 *
		 * @param {number} changed Zahl umklappender Stellen.
		 * @return {number} Längste Animationsdauer in ms (0 bei keinem Wechsel).
		 */
		function changeDurationMs( changed ) {
			if ( changed <= 0 ) {
				return 0;
			}
			var stagger = Math.max( 18, flipMs * 0.6 );
			// Letzte Klappe startet bei (changed - 1) * stagger; danach MAX_STEPS
			// Zwischenschritte plus ein Abschluss-Schritt, jeweils flipMs.
			return ( changed - 1 ) * stagger + ( MAX_STEPS + 1 ) * flipMs;
		}

		/**
		 * Volle Dauer eines Modus-B-Durchlaufs: kompletter Ring plus Abschluss-Tick.
		 *
		 * Alle Klappen starten synchron; der längste Durchlauf erreicht die letzte
		 * Ring-Position. Darauf stützen sich Intervall-Deckel und Ruhefenster.
		 *
		 * @return {number} Dauer in ms.
		 */
		function syncDurationMs() {
			return ( SYNC_RING.length + 1 ) * syncTickMs;
		}

		/**
		 * Wechselt im Modus B (synchron farbig) zur Szene idx. ALLE Klappen flippen,
		 * auch unveränderte, starten gleichzeitig bei Farbe 1 und laufen durch den
		 * vollständigen Ring bis zum jeweiligen Ziel.
		 *
		 * @param {number} idx Ziel-Szenenindex.
		 * @return {number} Dauer des Durchlaufs in ms.
		 */
		function goToSceneSync( idx ) {
			var target = flattenScene( scenes[ idx ] );

			for ( var i = 0; i < cells.length; i++ ) {
				var to = i < target.length ? target[ i ] : ' ';
				animateCellSync( cells[ i ], to, syncTickMs );
			}

			currentTokens = target;
			sceneIndex = idx;

			board.dispatchEvent( new CustomEvent( 'splitflap:flip', {
				detail: { changed: cells.length, sceneIndex: idx, stil: 'synchron' }
			} ) );

			return syncDurationMs();
		}

		/**
		 * Wechselt animiert zur Szene mit gegebenem Index. Nur geänderte Stellen
		 * klappen. Feuert «splitflap:flip» mit der Zahl umklappender Stellen.
		 *
		 * @param {number} idx Ziel-Szenenindex.
		 * @return {number} Längste Animationsdauer dieses Wechsels in ms.
		 */
		function goToScene( idx ) {
			if ( 'synchron' === stil ) {
				return goToSceneSync( idx );
			}

			var target = flattenScene( scenes[ idx ] );
			var changed = 0;
			var stagger = Math.max( 18, flipMs * 0.6 );

			for ( var i = 0; i < cells.length; i++ ) {
				var from = currentTokens[ i ];
				var to = i < target.length ? target[ i ] : ' ';
				if ( from === to ) {
					continue; // Gleicher Inhalt → klappt nicht.
				}
				changed++;
				( function ( cell, token, order ) {
					animateCell( cell, config, token, ( order - 1 ) * stagger, null );
				} )( cells[ i ], to, changed );
			}

			currentTokens = target;
			sceneIndex = idx;

			// Custom-Event: trägt die Zahl umklappender Stellen, der Sound hört zu.
			board.dispatchEvent( new CustomEvent( 'splitflap:flip', {
				detail: { changed: changed, sceneIndex: idx }
			} ) );

			return changeDurationMs( changed );
		}

		/**
		 * Initialer Aufbau: erste Szene vom Startzustand «durchrattern».
		 *
		 * @return {void}
		 */
		function buildFirstScene() {
			var target = flattenScene( scenes[ 0 ] );
			var changed = 0;
			var stagger = Math.max( 18, flipMs * 0.8 );

			for ( var i = 0; i < cells.length; i++ ) {
				var to = i < target.length ? target[ i ] : ' ';
				// Leere Zielstellen müssen nicht aufwendig durchrattern.
				if ( ' ' === to || '' === to ) {
					setStatic( cells[ i ], ' ' );
					continue;
				}
				changed++;
				( function ( cell, token, order ) {
					animateCell( cell, config, token, ( order - 1 ) * stagger, null );
				} )( cells[ i ], to, changed );
			}

			currentTokens = target;

			// Dauer des Erstaufbaus merken (gleiche Worst-Case-Formel, eigener Stagger).
			firstBuildDurationMs = changed > 0
				? ( changed - 1 ) * stagger + ( MAX_STEPS + 1 ) * flipMs
				: 0;

			board.dispatchEvent( new CustomEvent( 'splitflap:flip', {
				detail: { changed: changed, sceneIndex: 0 }
			} ) );
		}

		/**
		 * Zeigt alle Szenen-Inhalte statisch (reduced motion / kein JS-Flip).
		 *
		 * @return {void}
		 */
		function showStaticFirst() {
			var target = flattenScene( scenes[ 0 ] );
			for ( var i = 0; i < cells.length; i++ ) {
				setStatic( cells[ i ], i < target.length ? target[ i ] : ' ' );
			}
			currentTokens = target;
		}

		/**
		 * Startet den Szenen-Loop (nur bei mehr als einer Szene).
		 *
		 * Anders als ein starres setInterval plant dieser Loop den nächsten Wechsel
		 * erst, wenn der vorige Wechsel vollständig abgeschlossen ist und das Board
		 * mindestens REST_MS geruht hat. Das effektive Intervall ist deshalb
		 *   max( eingestelltesIntervall, längsteAnimationsdauer + REST_MS ).
		 * So kollidiert kein Wechsel mehr mit einer laufenden Animation und zwischen
		 * den Wechseln gibt es immer ein klares, ruhiges Board – auch bei Intervall 2 s
		 * mit vielen geänderten Stellen.
		 *
		 * @return {void}
		 */
		function startLoop() {
			if ( scenes.length < 2 || loopTimer || REDUCED ) {
				return;
			}

			// Vom Abschluss eines Wechsels (jetzt) bis zum Start des nächsten.
			function scheduleNext( lastDurationMs ) {
				var baseInterval = intervalSec * 1000;
				// Effektives Intervall: nie kürzer als Animationsdauer + Ruhepuffer.
				var effective = Math.max( baseInterval, ( lastDurationMs || 0 ) + REST_MS );

				loopTimer = window.setTimeout( function () {
					loopTimer = null;
					var next = ( sceneIndex + 1 ) % scenes.length;
					var dur = goToScene( next );
					// Nächsten Wechsel erst nach Abschluss + Ruhe planen.
					scheduleNext( dur );
				}, effective );
			}

			// Der erste geplante Wechsel rechnet noch ohne vorige Dauer; der
			// Erstaufbau (buildFirstScene) ist zu diesem Zeitpunkt bereits am Laufen,
			// deshalb beziehen wir dessen Dauer als Ruhebasis ein.
			scheduleNext( firstBuildDurationMs );
		}

		/**
		 * Pausiert den Loop (Board verlässt Viewport).
		 *
		 * @return {void}
		 */
		function stopLoop() {
			if ( loopTimer ) {
				window.clearTimeout( loopTimer );
				loopTimer = null;
			}
		}

		/**
		 * Aktiviert das Board (erstmals sichtbar).
		 *
		 * @return {void}
		 */
		function activate() {
			if ( started ) {
				startLoop();
				return;
			}
			started = true;

			if ( REDUCED ) {
				showStaticFirst();
				return; // Kein Loop, kein Sound.
			}

			buildFirstScene();
			startLoop();
		}

		/**
		 * Deaktiviert den Loop (Board verlässt Viewport), Zustand bleibt erhalten.
		 *
		 * @return {void}
		 */
		function deactivate() {
			stopLoop();
		}

		return { activate: activate, deactivate: deactivate, el: board };
	}

	/* ------------------------------------------------------------------ *
	 * Initialisierung aller Boards.
	 * ------------------------------------------------------------------ */
	function init() {
		var boards = document.querySelectorAll( '.split-flap:not(.split-flap--editor)' );
		if ( ! boards.length ) {
			return;
		}

		// Echte Vollbreite für alignfull-Tafeln setzen (scrollbar-sicher).
		FullBleed.init();

		var controllers = [];
		boards.forEach( function ( board ) {
			if ( board.getAttribute( 'data-sf-init' ) ) {
				return;
			}
			board.setAttribute( 'data-sf-init', '1' );
			var ctrl = createBoard( board );
			if ( ctrl ) {
				controllers.push( ctrl );
			}
		} );

		if ( ! controllers.length ) {
			return;
		}

		if ( ! ( 'IntersectionObserver' in window ) ) {
			controllers.forEach( function ( c ) {
				c.activate();
			} );
			return;
		}

		var observer = new IntersectionObserver(
			function ( entries ) {
				entries.forEach( function ( entry ) {
					var ctrl = controllers.filter( function ( c ) {
						return c.el === entry.target;
					} )[ 0 ];
					if ( ! ctrl ) {
						return;
					}
					if ( entry.isIntersecting ) {
						ctrl.activate();
					} else {
						ctrl.deactivate();
					}
				} );
			},
			{ threshold: 0.2 }
		);

		controllers.forEach( function ( c ) {
			observer.observe( c.el );
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
