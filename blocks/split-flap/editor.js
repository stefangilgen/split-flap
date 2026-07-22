/**
 * Split-Flap – Editor-Integration (build-frei).
 *
 * Bewusst ohne JSX und ohne Build-Schritt: Wir nutzen wp.element.createElement
 * direkt. So läuft das Plugin sofort nach dem Entpacken, ohne npm-Build. Die
 * Vorschau im Editor ist statisch (eine Klappe pro Zeichen) – die Flip-Animation
 * gehört ins Frontend.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelColorSettings = wp.blockEditor.PanelColorSettings;

	var PanelBody = wp.components.PanelBody;
	var TextControl = wp.components.TextControl;
	var RangeControl = wp.components.RangeControl;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var Notice = wp.components.Notice;

	var MAX_FELDER = 60;

	/**
	 * Zerlegt einen String mehrbyte-sicher in einzelne Zeichen.
	 *
	 * @param {string} str Eingabe.
	 * @return {Array<string>} Zeichen.
	 */
	function toChars( str ) {
		return Array.from( String( str ) );
	}

	/**
	 * Berechnet die effektive Klappenzahl und die Zielzeichen.
	 *
	 * @param {string} text   Zieltext (bereits gross/klein normalisiert).
	 * @param {number} felder Gewünschte Felderzahl, 0 = automatisch.
	 * @return {{cells: Array<string>, count: number, truncated: boolean}} Resultat.
	 */
	function computeCells( text, felder ) {
		var chars = toChars( text );
		var auto = 0 === felder;
		var count = auto ? Math.max( 1, chars.length ) : felder;
		count = Math.min( count, MAX_FELDER );

		var truncated = ! auto && chars.length > count;
		var cells = chars.slice( 0, count );
		while ( cells.length < count ) {
			cells.push( ' ' );
		}

		return { cells: cells, count: count, truncated: truncated };
	}

	registerBlockType( 'blitzdonner/split-flap', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;

			var text = attributes.grossschrift ? String( attributes.text ).toUpperCase() : attributes.text;
			var result = computeCells( text, attributes.felder );

			var fontClass = 'theme' === attributes.schrift ? 'split-flap--font-theme' : 'split-flap--font-mono';

			var blockProps = useBlockProps( {
				className: 'split-flap split-flap--editor ' + fontClass,
				style: {
					'--sf-text': attributes.textfarbe,
					'--sf-flap': attributes.klappenfarbe,
					// Effektive Klappenzahl auch im Editor setzen – sonst greift
					// der CSS-Fallback (25) und die Vorschau weicht vom Frontend ab.
					'--sf-stellen': String( result.count )
				}
			} );

			// Statische Vorschau: eine Klappe pro Zeichen, kein Rattern.
			var cells = result.cells.map( function ( ch, i ) {
				var isSpace = ' ' === ch || '' === ch;
				return el(
					'span',
					{
						key: i,
						className: 'split-flap__cell' + ( isSpace ? ' split-flap__cell--space' : '' )
					},
					el( 'span', { className: 'split-flap__char' }, isSpace ? '' : ch ),
					el( 'span', { className: 'split-flap__seam' } )
				);
			} );

			var preview = el(
				'div',
				blockProps,
				el( 'span', { className: 'split-flap__board', 'aria-hidden': 'true' }, cells )
			);

			var truncNotice = result.truncated
				? el(
						Notice,
						{ status: 'warning', isDismissible: false },
						__( 'Der Text ist länger als die Zeichenanzahl und wird auf', 'split-flap' ) +
							' ' +
							result.count +
							' ' +
							__( 'Zeichen gekürzt.', 'split-flap' )
				  )
				: null;

			var inspector = el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Inhalt', 'split-flap' ), initialOpen: true },
					el( TextControl, {
						label: __( 'Text', 'split-flap' ),
						value: attributes.text,
						onChange: function ( value ) {
							setAttributes( { text: value } );
						},
						help: __( 'Der anzuzeigende Zieltext.', 'split-flap' )
					} ),
					el( RangeControl, {
						label: __( 'Zeichenanzahl (Felder)', 'split-flap' ),
						value: attributes.felder,
						onChange: function ( value ) {
							setAttributes( { felder: undefined === value ? 0 : value } );
						},
						min: 0,
						max: MAX_FELDER,
						help: __( '0 = automatisch (Länge des Textes).', 'split-flap' )
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
						label: __( 'Startverhalten', 'split-flap' ),
						value: attributes.start,
						options: [
							{ label: __( 'Zufallszeichen', 'split-flap' ), value: 'zufall' },
							{ label: __( 'leer', 'split-flap' ), value: 'leer' },
							{ label: __( 'alphabetisch', 'split-flap' ), value: 'alpha' }
						],
						onChange: function ( value ) {
							setAttributes( { start: value } );
						}
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
						}
					} )
				),
				el(
					PanelBody,
					{ title: __( 'Darstellung', 'split-flap' ), initialOpen: false },
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
				el( PanelColorSettings, {
					title: __( 'Farben', 'split-flap' ),
					initialOpen: false,
					colorSettings: [
						{
							value: attributes.textfarbe,
							onChange: function ( value ) {
								setAttributes( { textfarbe: value || '#F4F4F4' } );
							},
							label: __( 'Textfarbe', 'split-flap' )
						},
						{
							value: attributes.klappenfarbe,
							onChange: function ( value ) {
								setAttributes( { klappenfarbe: value || '#1A1A1A' } );
							},
							label: __( 'Klappenfarbe', 'split-flap' )
						}
					]
				} )
			);

			return el( Fragment, null, inspector, truncNotice, preview );
		},

		// Dynamischer Block: das Frontend rendert serverseitig (render_callback).
		save: function () {
			return null;
		}
	} );
} )( window.wp );
