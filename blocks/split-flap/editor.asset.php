<?php
/**
 * Asset-Manifest für editor.js.
 *
 * WordPress liest diese Datei automatisch zum `file:./editor.js`-Eintrag in
 * block.json und registriert die hier genannten Abhängigkeiten und die Version.
 * Da das Editor-Script build-frei ist (kein Webpack), pflegen wir das Manifest
 * von Hand statt es generieren zu lassen.
 *
 * @package Split_Flap
 */

return array(
	'dependencies' => array(
		'wp-blocks',
		'wp-block-editor',
		'wp-components',
		'wp-element',
		'wp-i18n',
	),
	'version'      => '0.3.3',
);
