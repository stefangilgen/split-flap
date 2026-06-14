<?php
/**
 * Registriert den Gutenberg-Block «Split-Flap».
 *
 * Der Block wird per block.json registriert (metadata-driven). Das Frontend-Markup
 * liefert split_flap_render() über den render_callback – exakt dieselbe Funktion,
 * die auch der Shortcode nutzt.
 *
 * @package Split_Flap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registriert den Block aus seinem Verzeichnis.
 *
 * @return void
 */
function split_flap_register_block() {
	register_block_type(
		SPLIT_FLAP_DIR . 'blocks/split-flap',
		array(
			'render_callback' => 'split_flap_render_block',
		)
	);

	// Übersetzungen für die Editor-Strings an das Block-Script binden.
	// WordPress vergibt diesen Handle automatisch aus dem Block-Namen.
	if ( function_exists( 'wp_set_script_translations' ) ) {
		wp_set_script_translations(
			'blitzdonner-split-flap-editor-script',
			'split-flap',
			SPLIT_FLAP_DIR . 'languages'
		);
	}
}
add_action( 'init', 'split_flap_register_block' );

/**
 * Render-Callback des Blocks: reicht die Attribute an die gemeinsame Render-Funktion.
 *
 * @param array<string, mixed> $attributes Block-Attribute laut block.json.
 * @return string HTML-Markup.
 */
function split_flap_render_block( $attributes ) {
	return split_flap_render( is_array( $attributes ) ? $attributes : array() );
}
