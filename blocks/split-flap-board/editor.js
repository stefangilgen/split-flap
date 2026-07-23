/**
 * Split-Flap-Board – Editor-Integration (build-frei).
 *
 * Ohne JSX und ohne Build-Schritt: wp.element.createElement direkt. Die Vorschau
 * im Editor ist statisch (zeigt die erste Szene) – Flip-Animation und Loop
 * gehören ins Frontend.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelColorSettings = wp.blockEditor.PanelColorSettings;

	var PanelBody = wp.components.PanelBody;
	var TextareaControl = wp.components.TextareaControl;
	var RangeControl = wp.components.RangeControl;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var Button = wp.components.Button;
	var Notice = wp.components.Notice;

	var MAX_ZEILEN = 30;
	var MAX_STELLEN = 60;

	// Erlaubte Einzelzeichen: A–Z, 0–9, Leer und die elf Sonderzeichen. Bindestrich
	// «-» (U+002D) und Halbgeviertstrich «–» (U+2013) sind zwei verschiedene Zeichen.
	// Prüfung per indexOf statt Regex-Zeichenklasse wegen Mehrbyte-«–».
	var ALLOWED_CHARS = Array.from( 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +-.,–%&*?!/' );

	var DEFAULT_PALETTE = [
		'#E23B2E', '#F08A24', '#F4B400', '#FCE300', '#A8C700',
		'#2EA84F', '#0F9D8C', '#1FB6C1', '#2D9CDB', '#2D6CDF',
		'#4B47C4', '#8E44C4', '#D43BA8', '#2B2B2B', '#F4F4F4'
	];

	/**
	 * Zerlegt einen String in einzelne Zeichen.
	 *
	 * @param {string} str Eingabe.
	 * @return {Array<string>} Zeichen.
	 */
	function toChars( str ) {
		return Array.from( String( str ) );
	}

	/**
	 * Parst eine Eingabezeile in Stellen (Zeichen oder Farbflap-Token cN).
	 *
	 * @param {string}  zeile        Roh-Zeile.
	 * @param {boolean} grossschrift Grossschreibung erzwingen.
	 * @return {Array<{type:string, value:string}>} Stellen.
	 */
	function parseLine( zeile, grossschrift ) {
		var chars = toChars( zeile );
		var out = [];
		for ( var i = 0; i < chars.length; i++ ) {
			var ch = chars[ i ];
			if ( '{' === ch ) {
				var num = '';
				var j = i + 1;
				while ( j < chars.length && /[0-9]/.test( chars[ j ] ) ) {
					num += chars[ j ];
					j++;
				}
				if ( '' !== num && j < chars.length && '}' === chars[ j ] ) {
					var n = parseInt( num, 10 );
					if ( n >= 1 && n <= 15 ) {
						out.push( { type: 'color', value: String( n ) } );
						i = j;
						continue;
					}
				}
				out.push( { type: 'char', value: ' ' } );
				continue;
			}
			var norm = grossschrift ? ch.toUpperCase() : ch;
			if ( ALLOWED_CHARS.indexOf( norm ) < 0 ) {
				norm = ' ';
			}
			out.push( { type: 'char', value: norm } );
		}
		return out;
	}

	/**
	 * Baut ein Stellen-Raster aus einem Szenen-Text.
	 *
	 * @param {string}  text         Szenen-Text (Zeilen durch \n).
	 * @param {number}  zeilen       Board-Zeilen.
	 * @param {number}  stellen      Stellen pro Zeile.
	 * @param {boolean} grossschrift Grossschreibung.
	 * @return {{raster: Array, truncatedRows: boolean, truncatedCols: boolean}} Resultat.
	 */
	function buildScene( text, zeilen, stellen, grossschrift ) {
		var rohZeilen = String( text ).split( /\r\n|\r|\n/ );
		var truncatedRows = rohZeilen.length > zeilen;
		var truncatedCols = false;

		rohZeilen = rohZeilen.slice( 0, zeilen );

		var raster = [];
		for ( var z = 0; z < zeilen; z++ ) {
			var line = parseLine( rohZeilen[ z ] || '', grossschrift );
			if ( line.length > stellen ) {
				truncatedCols = true;
			}
			line = line.slice( 0, stellen );
			while ( line.length < stellen ) {
				line.push( { type: 'char', value: ' ' } );
			}
			raster.push( line );
		}

		return { raster: raster, truncatedRows: truncatedRows, truncatedCols: truncatedCols };
	}

	registerBlockType( 'blitzdonner/split-flap-board', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;

			var szenen = Array.isArray( attributes.szenen ) && attributes.szenen.length
				? attributes.szenen
				: [ '' ];
			var farben = Array.isArray( attributes.farben ) ? attributes.farben : [];

			// Welche Szene zeigt die Editor-Vorschau? Rein lokaler Ansichtszustand,
			// wird nicht gespeichert. Erlaubt das Umschalten der Vorschau zwischen Szenen.
			var vorschauState = useState( 0 );
			var vorschauSzene = vorschauState[ 0 ];
			var setVorschauSzene = vorschauState[ 1 ];

			// Index gegen die aktuelle Szenenzahl klemmen (nach Entfernen einer Szene).
			var aktiveVorschau = vorschauSzene;
			if ( aktiveVorschau > szenen.length - 1 ) {
				aktiveVorschau = szenen.length - 1;
			}
			if ( aktiveVorschau < 0 ) {
				aktiveVorschau = 0;
			}

			/**
			 * Liefert die effektive Farbe eines Index (eigene oder Default).
			 *
			 * @param {number} idx 0-basiert.
			 * @return {string} Hex.
			 */
			function colorAt( idx ) {
				return farben[ idx ] && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test( farben[ idx ] )
					? farben[ idx ]
					: DEFAULT_PALETTE[ idx ];
			}

			// Vorschau: gewählte Szene statisch (Default Szene 1).
			var built = buildScene( szenen[ aktiveVorschau ] || '', attributes.zeilen, attributes.stellen, attributes.grossschrift );

			var fontClass = 'theme' === attributes.schrift ? 'split-flap--font-theme' : 'split-flap--font-mono';

			// --sf-stellen muss auch in der Editor-Vorschau gesetzt sein – sonst
			// greift der CSS-Fallback (25) und die Klappenbreite weicht bei
			// weniger Stellen vom Frontend ab (render.php setzt sie inline).
			var styleVars = {
				'--sf-text': attributes.textfarbe,
				'--sf-flap': attributes.klappenfarbe,
				'--sf-frame': attributes.rahmenfarbe,
				'--sf-stellen': String( attributes.stellen )
			};
			for ( var ci = 0; ci < 15; ci++ ) {
				styleVars[ '--sf-color-' + ( ci + 1 ) ] = colorAt( ci );
			}

			var blockProps = useBlockProps( {
				className: 'split-flap split-flap--board split-flap--editor ' + fontClass,
				style: styleVars
			} );

			var rows = built.raster.map( function ( stellen, ri ) {
				var cells = stellen.map( function ( stelle, ci2 ) {
					if ( 'color' === stelle.type ) {
						return el(
							'span',
							{
								key: ci2,
								className: 'split-flap__cell split-flap__cell--color',
								style: { background: 'var(--sf-color-' + stelle.value + ')' }
							},
							el( 'span', { className: 'split-flap__char' }, '' ),
							el( 'span', { className: 'split-flap__seam' } )
						);
					}
					var isSpace = ' ' === stelle.value || '' === stelle.value;
					return el(
						'span',
						{
							key: ci2,
							className: 'split-flap__cell' + ( isSpace ? ' split-flap__cell--space' : '' )
						},
						el( 'span', { className: 'split-flap__char' }, isSpace ? '' : stelle.value ),
						el( 'span', { className: 'split-flap__seam' } )
					);
				} );
				return el( 'div', { key: ri, className: 'split-flap__row' }, cells );
			} );

			var preview = el(
				'div',
				blockProps,
				el( 'div', { className: 'split-flap__rows', 'aria-hidden': 'true' }, rows )
			);

			// Editor-Hinweise (Kürzung).
			var notices = [];
			if ( built.truncatedCols ) {
				notices.push( el(
					Notice,
					{ key: 'cols', status: 'warning', isDismissible: false },
					__( 'Mindestens eine Zeile ist länger als die Stellenzahl und wird gekürzt.', 'split-flap' )
				) );
			}
			if ( built.truncatedRows ) {
				notices.push( el(
					Notice,
					{ key: 'rows', status: 'warning', isDismissible: false },
					__( 'Diese Szene hat mehr Zeilen als das Board und wird gekürzt.', 'split-flap' )
				) );
			}

			// Szenen-Umschalter: zeigt je Szene einen Knopf; der aktive Knopf bestimmt,
			// welche Szene die Vorschau zeigt und welche im Textfeld editiert wird.
			var sceneSwitcher = szenen.length > 1
				? el(
						'div',
						{
							key: 'switcher',
							className: 'split-flap-scene-switcher',
							style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }
						},
						szenen.map( function ( ignored, idx ) {
							return el(
								Button,
								{
									key: idx,
									variant: idx === aktiveVorschau ? 'primary' : 'secondary',
									isPressed: idx === aktiveVorschau,
									onClick: function () {
										setVorschauSzene( idx );
									}
								},
								__( 'Szene', 'split-flap' ) + ' ' + ( idx + 1 )
							);
						} )
				  )
				: null;

			// Nur die aktive Szene wird editiert (zur Vorschau passend). So sieht die
			// Redaktorin beim Tippen unmittelbar das Ergebnis im Board.
			var aktiverText = szenen[ aktiveVorschau ] || '';
			var sceneEditor = el(
				'div',
				{ key: 'editor', className: 'split-flap-scene-editor', style: { marginBottom: '12px' } },
				el( TextareaControl, {
					label: __( 'Szene', 'split-flap' ) + ' ' + ( aktiveVorschau + 1 ),
					value: aktiverText,
					rows: attributes.zeilen,
					onChange: function ( value ) {
						var next = szenen.slice();
						next[ aktiveVorschau ] = value;
						setAttributes( { szenen: next } );
					},
					help: __( 'Eine Eingabezeile = eine Board-Zeile. Farbflap mit {1} bis {15}.', 'split-flap' )
				} ),
				szenen.length > 1
					? el(
							Button,
							{
								isDestructive: true,
								variant: 'secondary',
								onClick: function () {
									var next = szenen.slice();
									next.splice( aktiveVorschau, 1 );
									if ( ! next.length ) {
										next = [ '' ];
									}
									// Vorschau auf eine gültige Szene zurückziehen.
									var neuerIndex = aktiveVorschau > next.length - 1 ? next.length - 1 : aktiveVorschau;
									setVorschauSzene( neuerIndex );
									setAttributes( { szenen: next } );
								}
							},
							__( 'Szene entfernen', 'split-flap' )
					  )
					: null
			);

			var sceneControls = [ sceneSwitcher, sceneEditor ];

			var inspector = el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Szenen', 'split-flap' ), initialOpen: true },
					sceneControls,
					el(
						Button,
						{
							variant: 'secondary',
							onClick: function () {
								var next = szenen.concat( [ '' ] );
								// Vorschau direkt auf die neue, leere Szene umschalten.
								setVorschauSzene( next.length - 1 );
								setAttributes( { szenen: next } );
							}
						},
						__( 'Szene hinzufügen', 'split-flap' )
					)
				),
				el(
					PanelBody,
					{ title: __( 'Board', 'split-flap' ), initialOpen: false },
					el( RangeControl, {
						label: __( 'Zeilen', 'split-flap' ),
						value: attributes.zeilen,
						onChange: function ( value ) {
							setAttributes( { zeilen: undefined === value ? 1 : value } );
						},
						min: 1,
						max: MAX_ZEILEN
					} ),
					el( RangeControl, {
						label: __( 'Stellen pro Zeile', 'split-flap' ),
						value: attributes.stellen,
						onChange: function ( value ) {
							setAttributes( { stellen: undefined === value ? 25 : value } );
						},
						min: 1,
						max: MAX_STELLEN
					} ),
					el( ToggleControl, {
						label: __( 'Grossschreibung erzwingen', 'split-flap' ),
						checked: attributes.grossschrift,
						onChange: function ( value ) {
							setAttributes( { grossschrift: value } );
						}
					} )
				),
				el(
					PanelBody,
					{ title: __( 'Animation', 'split-flap' ), initialOpen: false },
					el( RangeControl, {
						label: __( 'Loop-Intervall (Sekunden)', 'split-flap' ),
						value: attributes.intervall,
						onChange: function ( value ) {
							setAttributes( { intervall: undefined === value ? 6 : value } );
						},
						min: 2,
						max: 30,
						help: __( 'Wirkt nur bei mehr als einer Szene.', 'split-flap' )
					} ),
					el( SelectControl, {
						label: __( 'Tempo', 'split-flap' ),
						value: attributes.tempo,
						options: [
							{ label: __( 'langsam', 'split-flap' ), value: 'langsam' },
							{ label: __( 'normal', 'split-flap' ), value: 'normal' },
							{ label: __( 'schnell', 'split-flap' ), value: 'schnell' }
						],
						onChange: function ( value ) {
							setAttributes( { tempo: value } );
						}
					} ),
					el( SelectControl, {
						label: __( 'Animationsstil', 'split-flap' ),
						value: attributes.stil,
						options: [
							{ label: __( 'Sequenziell (versetzt)', 'split-flap' ), value: 'sequenziell' },
							{ label: __( 'Synchron farbig', 'split-flap' ), value: 'synchron' }
						],
						onChange: function ( value ) {
							setAttributes( { stil: value } );
						},
						help: __( 'Synchron farbig: alle Klappen laufen beim Erstaufbau und bei jedem Szenenwechsel gemeinsam durch die Farben.', 'split-flap' )
					} ),
					el( SelectControl, {
						label: __( 'Zeichensatz', 'split-flap' ),
						value: attributes.zeichen,
						options: [
							{ label: __( 'A–Z 0–9', 'split-flap' ), value: 'alnum' },
							{ label: __( 'nur Zahlen', 'split-flap' ), value: 'zahlen' },
							{ label: __( 'erweitert (inkl. Sonderzeichen)', 'split-flap' ), value: 'erweitert' }
						],
						onChange: function ( value ) {
							setAttributes( { zeichen: value } );
						},
						help: __( 'Formt den Flicker beim Aufbau und bei sequenziellen Wechseln. Der synchron-farbige Wechsel läuft durch den festen Farbring.', 'split-flap' )
					} ),
					el( SelectControl, {
						label: __( 'Startverhalten', 'split-flap' ),
						value: attributes.start,
						options: [
							{ label: __( 'Zufallszeichen', 'split-flap' ), value: 'zufall' },
							{ label: __( 'alphabetisch', 'split-flap' ), value: 'alpha' }
						],
						onChange: function ( value ) {
							setAttributes( { start: value } );
						},
						help: __( 'Startglyph der Klappen beim sequenziellen Erstaufbau. Der synchron-farbige Erstaufbau startet immer auf Farbe 1.', 'split-flap' )
					} ),
					el( SelectControl, {
						label: __( 'Schrift', 'split-flap' ),
						value: attributes.schrift,
						options: [
							{ label: __( 'Mono', 'split-flap' ), value: 'mono' },
							{ label: __( 'Theme-Schrift', 'split-flap' ), value: 'theme' }
						],
						onChange: function ( value ) {
							setAttributes( { schrift: value } );
						}
					} )
				)
			);

			// Stile-Tab: zwei Panels. «Grundfarben» = die drei Anzeigefarben
			// (Text, Klappen, Rahmen), «Farbflaps» = die 15 Blockfarben der
			// {1}–{15}-Syntax (Attribut farben, Fallback DEFAULT_PALETTE).
			// PanelColorSettings bindet die Theme-Palette automatisch ein und
			// speichert Hex direkt in den Attributen (kein Slug-Auflösen im Render).
			// Fallbacks = die Board-Defaults aus block.json.
			var styleInspector = el(
				InspectorControls,
				{ group: 'styles' },
				el( PanelColorSettings, {
					title: __( 'Grundfarben', 'split-flap' ),
					initialOpen: true,
					colorSettings: [
						{
							value: attributes.textfarbe,
							onChange: function ( value ) {
								setAttributes( { textfarbe: value || '#C8C8C8' } );
							},
							label: __( 'Textfarbe', 'split-flap' )
						},
						{
							value: attributes.klappenfarbe,
							onChange: function ( value ) {
								setAttributes( { klappenfarbe: value || '#1A1A1A' } );
							},
							label: __( 'Klappenfarbe', 'split-flap' )
						},
						{
							value: attributes.rahmenfarbe,
							onChange: function ( value ) {
								setAttributes( { rahmenfarbe: value || '#303030' } );
							},
							label: __( 'Rahmenfarbe', 'split-flap' )
						}
					]
				} ),
				el( PanelColorSettings, {
					title: __( 'Farbflaps', 'split-flap' ),
					initialOpen: false,
					colorSettings: DEFAULT_PALETTE.map( function ( ignored, idx ) {
						return {
							value: colorAt( idx ),
							onChange: function ( value ) {
								var next = farben.slice();
								while ( next.length < 15 ) {
									next.push( '' );
								}
								next[ idx ] = value || DEFAULT_PALETTE[ idx ];
								setAttributes( { farben: next } );
							},
							label: __( 'Farbflap', 'split-flap' ) + ' ' + ( idx + 1 )
						};
					} )
				} )
			);

			return el( Fragment, null, inspector, styleInspector, notices, preview );
		},

		// Dynamischer Block: das Frontend rendert serverseitig (render_callback).
		save: function () {
			return null;
		}
	} );
} )( window.wp );
