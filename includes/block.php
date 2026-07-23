<?php
/**
 * Registriert den Gutenberg-Block «Split-Flap-Board».
 *
 * Der Block wird per block.json registriert (metadata-driven). Das Frontend-Markup
 * liefert split_flap_render_board() über den render_callback – exakt dieselbe
 * Funktion, die auch der Shortcode [split_flap_board] nutzt.
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
	// Mehrzeiliges Board mit Szenen und Farbflaps – der einzige Block seit v0.5.0.
	register_block_type(
		SPLIT_FLAP_DIR . 'blocks/split-flap-board',
		array(
			'render_callback' => 'split_flap_render_board_block',
		)
	);

	// Übersetzungen für die Editor-Strings an das Block-Script binden.
	// WordPress vergibt dieses Handle automatisch aus dem Block-Namen.
	if ( function_exists( 'wp_set_script_translations' ) ) {
		wp_set_script_translations(
			'blitzdonner-split-flap-board-editor-script',
			'split-flap',
			SPLIT_FLAP_DIR . 'languages'
		);
	}
}
add_action( 'init', 'split_flap_register_block' );

/**
 * Render-Callback des Board-Blocks: reicht die Attribute an die Board-Render-Funktion.
 *
 * @param array<string, mixed> $attributes Block-Attribute laut block.json.
 * @return string HTML-Markup.
 */
function split_flap_render_board_block( $attributes ) {
	return split_flap_render_board( is_array( $attributes ) ? $attributes : array() );
}
