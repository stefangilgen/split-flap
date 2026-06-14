/**
 * Split-Flap-Board – Editor-Integration (build-frei).
 *
 * Ohne JSX und ohne Build-Schritt: wp.element.createElement direkt. Die Vorschau
 * im Editor ist statisch (zeigt die erste Szene) – Flip-Animation, Loop und Sound
 * gehören ins Frontend.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;

	var PanelBody = wp.components.PanelBody;
	var TextareaControl = wp.components.TextareaControl;
	var RangeControl = wp.components.RangeControl;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var Button = wp.components.Button;
	var Notice = wp.components.Notice;
	var ColorPicker = wp.components.ColorPicker;

	var MAX_ZEILEN = 30;
	var MAX_STELLEN = 60;

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
			if ( ! /^[A-Z0-9]$/.test( norm ) ) {
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

			// Vorschau: erste Szene statisch.
			var built = buildScene( szenen[ 0 ] || '', attributes.zeilen, attributes.stellen, attributes.grossschrift );

			var fontClass = 'theme' === attributes.schrift ? 'split-flap--font-theme' : 'split-flap--font-mono';

			var styleVars = {
				'--sf-text': attributes.textfarbe,
				'--sf-flap': attributes.klappenfarbe
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
							el( 'span', { className: 'split-flap__char' }, '' )
						);
					}
					var isSpace = ' ' === stelle.value || '' === stelle.value;
					return el(
						'span',
						{
							key: ci2,
							className: 'split-flap__cell' + ( isSpace ? ' split-flap__cell--space' : '' )
						},
						el( 'span', { className: 'split-flap__char' }, isSpace ? '' : stelle.value )
					);
				} );
				return el( 'div', { key: ri, className: 'split-flap__row' }, cells );
			} );

			var preview = el(
				'div',
				blockProps,
				el(
					'button',
					{ type: 'button', className: 'split-flap__sound', 'aria-pressed': 'false', tabIndex: -1 },
					el( 'span', { className: 'split-flap__sound-icon', 'aria-hidden': 'true' } )
				),
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
					__( 'Die erste Szene hat mehr Zeilen als das Board und wird gekürzt.', 'split-flap' )
				) );
			}

			// Szenen-Editoren.
			var sceneControls = szenen.map( function ( text, idx ) {
				return el(
					'div',
					{ key: idx, className: 'split-flap-scene-editor', style: { marginBottom: '12px' } },
					el( TextareaControl, {
						label: __( 'Szene', 'split-flap' ) + ' ' + ( idx + 1 ),
						value: text,
						rows: attributes.zeilen,
						onChange: function ( value ) {
							var next = szenen.slice();
							next[ idx ] = value;
							setAttributes( { szenen: next } );
						},
						help: 0 === idx
							? __( 'Eine Eingabezeile = eine Board-Zeile. Farbflap mit {1} bis {15}.', 'split-flap' )
							: undefined
					} ),
					szenen.length > 1
						? el(
								Button,
								{
									isDestructive: true,
									variant: 'secondary',
									onClick: function () {
										var next = szenen.slice();
										next.splice( idx, 1 );
										setAttributes( { szenen: next.length ? next : [ '' ] } );
									}
								},
								__( 'Szene entfernen', 'split-flap' )
						  )
						: null
				);
			} );

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
							variant: 'primary',
							onClick: function () {
								setAttributes( { szenen: szenen.concat( [ '' ] ) } );
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
							setAttributes( { zeilen: undefined === value ? 6 : value } );
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
					{ title: __( 'Animation und Sound', 'split-flap' ), initialOpen: false },
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
				),
				el(
					PanelBody,
					{ title: __( 'Farbflaps', 'split-flap' ), initialOpen: false },
					el(
						'p',
						{ style: { fontSize: '12px', opacity: 0.8 } },
						__( 'Die 15 Farben der {1}- bis {15}-Syntax.', 'split-flap' )
					),
					DEFAULT_PALETTE.map( function ( def, idx ) {
						return el(
							PanelBody,
							{
								key: idx,
								title: __( 'Farbflap', 'split-flap' ) + ' ' + ( idx + 1 ),
								initialOpen: false
							},
							el( ColorPicker, {
								color: colorAt( idx ),
								enableAlpha: false,
								onChangeComplete: function ( value ) {
									var next = farben.slice();
									while ( next.length < 15 ) {
										next.push( '' );
									}
									next[ idx ] = value && value.hex ? value.hex : DEFAULT_PALETTE[ idx ];
									setAttributes( { farben: next } );
								}
							} )
						);
					} )
				)
			);

			return el( Fragment, null, inspector, notices, preview );
		},

		// Dynamischer Block: das Frontend rendert serverseitig (render_callback).
		save: function () {
			return null;
		}
	} );
} )( window.wp );
