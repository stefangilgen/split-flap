/**
 * Split-Flap – Frontend-Engine (Vanilla JS, keine Abhängigkeiten).
 *
 * Aufgaben:
 *  1. IntersectionObserver startet jedes Board erst, wenn es sichtbar wird, und
 *     steuert den Szenen-Loop (pausiert ausserhalb des Viewports).
 *  2. Jede Stelle rattert vom alten zum neuen Inhalt; nur geänderte Stellen klappen.
 *  3. Szenen wechseln automatisch im konfigurierten Intervall (Loop).
 *  4. Jeder Wechsel feuert ein Custom-Event «splitflap:flip» am Board-Element.
 *  5. Sound: synthetisch über die Web Audio API (kein Audio-File), erst nach der
 *     ersten Nutzergeste am Ton-Toggle (Autoplay-Policy). Default stumm.
 *  6. prefers-reduced-motion: reduce → nur erste Szene statisch, kein Loop, kein Sound.
 *
 * Animation und Sound sind entkoppelt: der Sound hängt allein am Custom-Event.
 */
( function () {
	'use strict';

	var REDUCED = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	var ALPHA_SEQUENCE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	// Höchstzahl Zwischenschritte pro Klappe. Deterministische Obergrenze, damit
	// die längste mögliche Animationsdauer im Voraus berechenbar ist (Aufgabe 1).
	var MAX_STEPS = 7;

	// Ruhepuffer nach Abschluss eines Wechsels, bevor der nächste starten darf.
	// Das garantiert ein sichtbares, scharfes Board zwischen den Wechseln.
	var REST_MS = 800;

	/* ------------------------------------------------------------------ *
	 * Sound: gemeinsamer AudioContext, erst nach Nutzergeste entsperrt.
	 * ------------------------------------------------------------------ */
	var Sound = ( function () {
		var ctx = null;
		var noiseBuffer = null;

		/**
		 * Entsperrt (oder erstellt) den AudioContext. Muss aus einer Nutzergeste
		 * heraus laufen, sonst greift die Autoplay-Sperre.
		 *
		 * @return {boolean} true, wenn ein laufender Context vorliegt.
		 */
		function unlock() {
			var AC = window.AudioContext || window.webkitAudioContext;
			if ( ! AC ) {
				return false;
			}
			if ( ! ctx ) {
				try {
					ctx = new AC();
				} catch ( e ) {
					return false;
				}
			}
			if ( 'suspended' === ctx.state && ctx.resume ) {
				ctx.resume();
			}
			if ( ! noiseBuffer ) {
				noiseBuffer = buildNoiseBuffer( ctx );
			}
			return 'running' === ctx.state || 'suspended' === ctx.state;
		}

		/**
		 * Baut einen kurzen Rauschpuffer (Quelle für das perkussive Klappern).
		 *
		 * @param {AudioContext} context AudioContext.
		 * @return {AudioBuffer} Rauschpuffer.
		 */
		function buildNoiseBuffer( context ) {
			var len = Math.floor( context.sampleRate * 0.05 );
			var buffer = context.createBuffer( 1, len, context.sampleRate );
			var data = buffer.getChannelData( 0 );
			for ( var i = 0; i < len; i++ ) {
				data[ i ] = Math.random() * 2 - 1;
			}
			return buffer;
		}

		/**
		 * Spielt n perkussive Klicks (gefiltertes Rauschen, sehr kurze Hüllkurve).
		 * Die Zahl gleichzeitiger Impulse wird gedeckelt, damit es nicht übersteuert.
		 *
		 * @param {number} count Zahl umklappender Stellen.
		 * @return {void}
		 */
		function clatter( count ) {
			if ( ! ctx || 'running' !== ctx.state || ! noiseBuffer ) {
				return;
			}

			// Max. 8 Impulse pro Aufruf gegen Übersteuern (Spezifikation).
			var impulses = Math.max( 1, Math.min( 8, count ) );
			// Lautstärke pro Impuls zusätzlich gegen die Zahl der Klappen skalieren.
			var perGain = 0.18 / Math.sqrt( impulses );

			for ( var i = 0; i < impulses; i++ ) {
				playClick( perGain, i * 0.012 + Math.random() * 0.01 );
			}
		}

		/**
		 * Ein einzelner Klick: Rauschquelle → Bandpass → Hüllkurve.
		 *
		 * @param {number} gain  Spitzen-Lautstärke.
		 * @param {number} delay Startverzögerung in Sekunden.
		 * @return {void}
		 */
		function playClick( gain, delay ) {
			var now = ctx.currentTime + delay;

			var src = ctx.createBufferSource();
			src.buffer = noiseBuffer;

			var filter = ctx.createBiquadFilter();
			filter.type = 'bandpass';
			filter.frequency.value = 1400 + Math.random() * 800;
			filter.Q.value = 0.8;

			var env = ctx.createGain();
			env.gain.setValueAtTime( 0.0001, now );
			env.gain.exponentialRampToValueAtTime( gain, now + 0.002 );
			env.gain.exponentialRampToValueAtTime( 0.0001, now + 0.045 );

			src.connect( filter );
			filter.connect( env );
			env.connect( ctx.destination );

			src.start( now );
			src.stop( now + 0.06 );
		}

		return { unlock: unlock, clatter: clatter };
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

		var intervalSec = parseInt( board.getAttribute( 'data-sf-intervall' ), 10 ) || 6;

		// Aktuelle Token je Stelle (flach, in DOM-Reihenfolge der Zellen).
		var currentTokens = flattenScene( scenes[ 0 ] );

		var sceneIndex = 0;
		var loopTimer = null;
		var soundOn = false;
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
		 * Wechselt animiert zur Szene mit gegebenem Index. Nur geänderte Stellen
		 * klappen. Feuert «splitflap:flip» mit der Zahl umklappender Stellen.
		 *
		 * @param {number} idx Ziel-Szenenindex.
		 * @return {number} Längste Animationsdauer dieses Wechsels in ms.
		 */
		function goToScene( idx ) {
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
					animateCell( cell, config, token, ( order - 1 ) * stagger, function () {
						// Sound hängt am Custom-Event, nicht direkt hier.
					} );
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

		// Sound an das Custom-Event hängen.
		board.addEventListener( 'splitflap:flip', function ( ev ) {
			if ( ! soundOn || REDUCED ) {
				return;
			}
			var changed = ev.detail && ev.detail.changed ? ev.detail.changed : 0;
			if ( changed > 0 ) {
				Sound.clatter( changed );
			}
		} );

		// Ton-Toggle verdrahten.
		var toggle = board.querySelector( '.split-flap__sound' );
		if ( toggle ) {
			toggle.addEventListener( 'click', function () {
				if ( ! soundOn ) {
					var ok = Sound.unlock(); // Erste Nutzergeste entsperrt den Context.
					soundOn = ok;
				} else {
					soundOn = false;
				}
				toggle.setAttribute( 'aria-pressed', soundOn ? 'true' : 'false' );
				var label = soundOn
					? ( toggle.getAttribute( 'data-sf-sound-on' ) || 'Ton ausschalten' )
					: ( toggle.getAttribute( 'data-sf-sound-off' ) || 'Ton einschalten' );
				toggle.setAttribute( 'aria-label', label );
			} );
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
