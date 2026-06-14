# Split-Flap

Animierte Fallblattanzeige für WordPress – die klassische Split-Flap-Tafel aus Bahnhof und Flughafen, als Gutenberg-Block und als Shortcode. Reines PHP, Vanilla JS und CSS, ohne Drittanbieter-Bibliothek.

Internes Experiment von Blitz & Donner. Kein Kundenprojekt.

## Zweck

Eine Redaktorin setzt einen kurzen Text. Das Plugin rendert ihn als Reihe mechanischer Klappen, die beim Erscheinen im Viewport vom Startzustand zum Zieltext durchrattern und versetzt von links nach rechts stoppen. Genau eine Zeile pro Anzeige.

## Installation

1. Den Ordner `split-flap` nach `wp-content/plugins/` kopieren (oder als ZIP über *Plugins → Installieren → Plugin hochladen* einspielen).
2. Im Backend unter *Plugins* «Split-Flap» aktivieren.

Es gibt keinen Build-Schritt. Der Block läuft build-frei über `wp.element` – kein npm, kein Webpack nötig. Voraussetzungen: WordPress 6.6+ und PHP 7.4+.

## Nutzung als Block

Im Block-Editor «Split-Flap» einfügen (Kategorie *Medien*, Suchbegriffe «split-flap», «fallblatt»). Den Text eintippen – die Vorschau zeigt sofort eine statische Klappe pro Zeichen. Die Optionen liegen in der Seitenleiste, gruppiert nach Inhalt, Animation, Darstellung und Farben. Die Flip-Animation selbst läuft erst im Frontend.

Ist der Text länger als die eingestellte Zeichenanzahl, kürzt der Block auf diese Zahl und blendet im Editor einen Hinweis ein.

## Nutzung als Shortcode

```text
[split_flap text="ABFAHRT" felder="7" tempo="normal" start="zufall"]
```

Block und Shortcode teilen sich genau eine Render-Funktion. Das Frontend-Ergebnis ist identisch.

### Shortcode-Parameter

| Parameter | Werte | Default | Wirkung |
|---|---|---|---|
| `text` | beliebiger kurzer Text | leer | Der anzuzeigende Zieltext |
| `felder` | Zahl `0`–`60` | `0` | Feste Klappenzahl; `0` = automatisch (Länge des Textes). Kürzt oder füllt mit Leerklappen |
| `tempo` | `langsam` / `normal` / `schnell` | `normal` | Tempo des Durchratterns pro Klappe |
| `start` | `zufall` / `leer` / `alphabetisch` | `zufall` | Ausgangszustand vor dem Stoppen |
| `zeichensatz` | `alnum` / `zahlen` / `erweitert` | `alnum` | Zeichen, die beim Rattern erscheinen |
| `textfarbe` | Hex-Farbe | `#F4F4F4` | Farbe der Ziffern und Buchstaben |
| `klappenfarbe` | Hex-Farbe | `#1A1A1A` | Hintergrund der Klappe |
| `schrift` | `mono` / `theme` | `mono` | Schriftbild der Klappe |
| `grossschrift` | `true` / `false` | `true` | Wandelt die Eingabe in Grossbuchstaben |

Die Werte für `start` und `zeichensatz` akzeptieren auch Langformen: `start="alphabetisch"`, `zeichensatz="nur-zahlen"`.

## Konfigurierbare Optionen

| Option | Typ | Default | Wirkung |
|---|---|---|---|
| Text | Textfeld | leer | Der anzuzeigende Zieltext |
| Zeichenanzahl (Felder) | Zahl `0`–`60` | `0` (= Textlänge) | Feste Anzahl Klappen; füllt mit Leerzeichen oder kürzt |
| Animationsgeschwindigkeit | langsam / normal / schnell | normal | Tempo des Durchratterns pro Klappe |
| Startverhalten | Zufallszeichen / leer / alphabetisch | Zufallszeichen | Ausgangszustand vor dem Stoppen |
| Zeichensatz | A–Z 0–9 / nur Zahlen / erweitert | A–Z 0–9 | Welche Zeichen beim Durchrattern erscheinen |
| Textfarbe | Color Picker | `#F4F4F4` | Farbe der Ziffern und Buchstaben |
| Klappenfarbe | Color Picker | `#1A1A1A` | Hintergrund der Klappe |
| Schrift | Mono / Theme-Schrift | Mono | Schriftbild der Klappe |
| Grossschreibung erzwingen | Schalter | an | Wandelt Eingabe in Grossbuchstaben |

## Barrierefreiheit

- Der Zieltext steht für Screenreader als zusammenhängender String in einem visuell versteckten Element; die animierten Klappen tragen `aria-hidden`.
- Bei der Systemeinstellung *Bewegung reduzieren* (`prefers-reduced-motion: reduce`) erscheint der Zieltext sofort und statisch, ohne Flip-Animation.
- Der Default-Farbkontrast (Text `#F4F4F4` auf Klappe `#1A1A1A`) liegt bei rund 16:1 und damit deutlich über der Schwelle von 4.5:1.

## Performance

- Anzeigen starten erst, wenn sie per IntersectionObserver in den Viewport kommen.
- Die Animation läuft ausschliesslich über CSS-Transforms (`rotateX`), nicht über layout-auslösende Eigenschaften.
- Bedingtes Enqueue: Auf Seiten ohne Block und ohne Shortcode lädt das Plugin weder CSS noch JS.

## Architektur

| Datei | Aufgabe |
|---|---|
| `split-flap.php` | Plugin-Header, Konstanten, Laden der Module, Text-Domain |
| `includes/render.php` | Gemeinsame Render-Funktion: Validierung, Escaping, HTML-Aufbau |
| `includes/assets.php` | Registrierung und bedingtes Enqueue von CSS/JS |
| `includes/block.php` | Block-Registrierung über `block.json`, Render-Callback |
| `includes/shortcode.php` | Shortcode `[split_flap]`, Mapping auf die Render-Funktion |
| `blocks/split-flap/block.json` | Block-Metadaten und Attribute |
| `blocks/split-flap/editor.js` | Editor-Vorschau und Seitenleiste (build-frei) |
| `assets/css/split-flap.css` | Klappen-Stile, Flip-Keyframes, Reduced-Motion |
| `assets/js/split-flap.js` | IntersectionObserver und Flip-Mechanik im Frontend |

## Scope-Grenze v1

Bewusst nicht enthalten: Live-Datenfeed, automatischer Textwechsel, Sound, mehrzeiliges Board, Klick- oder Hover-Interaktion, globale Plugin-Einstellungen, zentrales Skin-System. Alle Optionen leben am Block beziehungsweise im Shortcode.

## Lizenz

GPL-2.0-or-later.
