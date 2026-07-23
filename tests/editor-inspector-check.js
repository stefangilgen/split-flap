/**
 * Selbstcheck für die Inspector-Struktur des Board-Blocks (build-frei, ohne Framework).
 *
 * Lädt das echte editor.js mit einem minimalen wp-Stub und prüft:
 * 1. Stile-Tab: zwei PanelColorSettings – «Grundfarben» (3) und «Farbflaps» (15, zugeklappt).
 * 2. Farbflap-Werte fallen ohne eigene Farbe auf DEFAULT_PALETTE zurück.
 * 3. onChange schreibt Hex an den richtigen Index und füllt das Array auf 15 auf.
 * 4. onChange mit leerem Wert setzt den Default-Hex des Index.
 * 5. Einstellungen-Tab enthält keine Farb-Controls mehr (nur Szenen, Board, Animation).
 *
 * Aufruf: node tests/editor-inspector-check.js
 */
'use strict';

var fs = require( 'fs' );
var path = require( 'path' );

var blockJson = JSON.parse( fs.readFileSync( path.join( __dirname, '../blocks/split-flap-board/block.json' ), 'utf8' ) );

var registered = null;

function flatten( args ) {
	var out = [];
	args.forEach( function ( a ) {
		if ( Array.isArray( a ) ) {
			out = out.concat( flatten( a ) );
		} else if ( null !== a && undefined !== a && false !== a ) {
			out.push( a );
		}
	} );
	return out;
}

var wpStub = {
	element: {
		createElement: function ( type, props ) {
			return { type: type, props: props || {}, children: flatten( Array.prototype.slice.call( arguments, 2 ) ) };
		},
		Fragment: 'Fragment',
		useState: function ( init ) {
			return [ init, function () {} ];
		}
	},
	i18n: { __: function ( s ) { return s; } },
	blocks: {
		registerBlockType: function ( name, settings ) {
			registered = { name: name, settings: settings };
		}
	},
	blockEditor: {
		useBlockProps: function ( p ) { return p; },
		InspectorControls: 'InspectorControls',
		PanelColorSettings: 'PanelColorSettings'
	},
	components: {
		PanelBody: 'PanelBody',
		TextareaControl: 'TextareaControl',
		RangeControl: 'RangeControl',
		SelectControl: 'SelectControl',
		ToggleControl: 'ToggleControl',
		Button: 'Button',
		Notice: 'Notice',
		ColorPicker: 'ColorPicker'
	}
};

global.window = { wp: wpStub };
require( path.join( __dirname, '../blocks/split-flap-board/editor.js' ) );

var fails = 0;
function check( ok, msg ) {
	console.log( ( ok ? 'PASS' : 'FAIL' ) + ' – ' + msg );
	if ( ! ok ) {
		fails++;
	}
}

function findAll( node, pred, acc ) {
	acc = acc || [];
	if ( ! node || 'object' !== typeof node ) {
		return acc;
	}
	if ( pred( node ) ) {
		acc.push( node );
	}
	( node.children || [] ).forEach( function ( c ) {
		findAll( c, pred, acc );
	} );
	return acc;
}

function defaults() {
	var attrs = {};
	Object.keys( blockJson.attributes ).forEach( function ( k ) {
		var d = blockJson.attributes[ k ].default;
		attrs[ k ] = Array.isArray( d ) ? d.slice() : d;
	} );
	return attrs;
}

function render( attrs, setAttributes ) {
	return registered.settings.edit( {
		attributes: attrs,
		setAttributes: setAttributes || function () {}
	} );
}

check( null !== registered && 'blitzdonner/split-flap-board' === registered.name, 'Block registriert' );

// Struktur mit Default-Attributen (farben leer).
var tree = render( defaults() );
var inspectors = findAll( tree, function ( n ) { return 'InspectorControls' === n.type; } );
var settingsTab = inspectors.filter( function ( n ) { return 'styles' !== n.props.group; } );
var stylesTab = inspectors.filter( function ( n ) { return 'styles' === n.props.group; } );

check( 1 === settingsTab.length && 1 === stylesTab.length, 'je ein InspectorControls für Einstellungen und Stile' );

// Stile-Tab: Grundfarben + Farbflaps.
var colorPanels = findAll( stylesTab[ 0 ], function ( n ) { return 'PanelColorSettings' === n.type; } );
check( 2 === colorPanels.length, 'Stile-Tab hat genau zwei PanelColorSettings' );
check( 'Grundfarben' === colorPanels[ 0 ].props.title && 3 === colorPanels[ 0 ].props.colorSettings.length, 'Grundfarben zuerst, mit 3 Farben' );
check( 'Farbflaps' === colorPanels[ 1 ].props.title && 15 === colorPanels[ 1 ].props.colorSettings.length, 'Farbflaps darunter, mit 15 Farben' );
check( false === colorPanels[ 1 ].props.initialOpen, 'Farbflaps-Panel ist standardmässig zugeklappt' );

var flaps = colorPanels[ 1 ].props.colorSettings;
check( 'Farbflap 1' === flaps[ 0 ].label && 'Farbflap 15' === flaps[ 14 ].label, 'Labels Farbflap 1 … Farbflap 15' );
check( '#E23B2E' === flaps[ 0 ].value && '#F4F4F4' === flaps[ 14 ].value, 'ohne eigene Farbe gilt DEFAULT_PALETTE' );

// onChange schreibt an den richtigen Index und füllt auf 15 auf.
var written = null;
tree = render( defaults(), function ( next ) { written = next; } );
flaps = findAll( tree, function ( n ) { return 'PanelColorSettings' === n.type && 'Farbflaps' === n.props.title; } )[ 0 ].props.colorSettings;
flaps[ 2 ].onChange( '#123456' );
check( null !== written && 15 === written.farben.length, 'onChange liefert ein 15er-Array' );
check( '#123456' === written.farben[ 2 ] && '' === written.farben[ 0 ] && '' === written.farben[ 14 ], 'Hex landet an Index 2, Rest bleibt leer' );

// Eigene Farbe wird angezeigt; Löschen fällt auf den Default zurück.
var attrs = defaults();
attrs.farben = [ '', '', '#0A0B0C' ];
written = null;
tree = render( attrs, function ( next ) { written = next; } );
flaps = findAll( tree, function ( n ) { return 'PanelColorSettings' === n.type && 'Farbflaps' === n.props.title; } )[ 0 ].props.colorSettings;
check( '#0A0B0C' === flaps[ 2 ].value, 'gesetzte Farbe wird angezeigt' );
flaps[ 2 ].onChange( undefined );
check( null !== written && '#F4B400' === written.farben[ 2 ], 'Löschen setzt den Default des Index (Farbflap 3)' );

// Einstellungen-Tab: keine Farb-Controls, nur Szenen/Board/Animation.
var settingsColor = findAll( settingsTab[ 0 ], function ( n ) {
	return 'PanelColorSettings' === n.type || 'ColorPicker' === n.type;
} );
check( 0 === settingsColor.length, 'Einstellungen-Tab enthält keine Farb-Controls' );
var panelTitles = findAll( settingsTab[ 0 ], function ( n ) { return 'PanelBody' === n.type; } ).map( function ( n ) {
	return n.props.title;
} );
check( 'Szenen,Board,Animation' === panelTitles.join( ',' ), 'Einstellungen-Panels sind exakt Szenen, Board, Animation' );

process.exit( fails ? 1 : 0 );
