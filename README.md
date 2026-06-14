# Split-Flap

Animierte Fallblattanzeige für WordPress – die klassische Split-Flap-Tafel aus Bahnhof und Flughafen, als Gutenberg-Block und als Shortcode. Reines PHP, Vanilla JS und CSS, ohne Drittanbieter-Bibliothek.

Internes Experiment von Blitz & Donner. Kein Kundenprojekt.

## Zweck

Eine Redaktorin setzt einen kurzen Text. Das Plugin rendert ihn als Reihe mechanischer Klappen, die beim Erscheinen im Viewport vom Startzustand zum Zieltext durchrattern und versetzt von links nach rechts stoppen.

Ab Version 0.2.0 gibt es zwei Anzeigen: die einzeilige Tafel aus v1 und ein mehrzeiliges **Board** (Departure-Board) mit automatischem Szenen-Wechsel, Farbflaps und synthetischem Klappersound.

## Das Board (v2)

Das Board ist eine Abfahrtstafel mit fester Zeilen- und Stellenzahl, Default **6 Zeilen × 25 Stellen** (150 Klappen). Es hält eine oder mehrere **Szenen**; bei mehr als einer Szene wechselt es automatisch in einem Intervall durch und rattert dabei nur die geänderten Stellen. Jeder Wechsel kann von einem Klappersound begleitet werden, der erst nach einer Nutzergeste am Ton-Toggle klingt.

### Farbflaps

Im Text setzt die Syntax `{1}` bis `{15}` einen farbigen Block. Jede Markierung belegt genau eine Stelle. `{0}`, `{16}` und höher, `{}` oder Unfug wie `{ab}` werden zur Leer-Klappe – kein Fehler. Die 15 Farben sind pro Board frei wählbar (15 Color-Picker im Block, Attribut `farben` im Shortcode); fehlt oder stimmt eine Farbe nicht, greift die Default-Palette.

### Visuelle Herkunft

Die Optik orientiert sich am Projekt **roosterfish/fallblatt** – übernommen wurde der Look (Schrift Overpass Mono, helles Grau auf dunklen Klappen, horizontaler Mittelspalt mit seitlichen Achsstummeln als Scharniere, dunkles Anthrazit). Der jQuery-Code der Referenz wurde **nicht** übernommen; das Plugin bleibt bei eigener Vanilla-JS-Umsetzung ohne Drittbibliothek.

### Sound

Der Klappersound entsteht synthetisch über die Web Audio API – keine Audiodatei, keine Bibliothek. Pro umklappender Stelle ein kurzer perkussiver Klick aus gefiltertem Rauschen; viele Stellen ergeben das Rattern. Die Lautstärke ist gedeckelt, damit 150 Klappen nicht übersteuern. Default ist stumm: erst der Klick auf den Ton-Toggle (echtes `<button>` mit `aria-pressed`, per Tastatur bedienbar) entsperrt den AudioContext und schaltet den Ton ein. Bei *Bewegung reduzieren* bleibt der Toggle sichtbar, aber wirkungslos.

## Installation

1. Den Ordner `split-flap` nach `wp-content/plugins/` kopieren (oder als ZIP über *Plugins → Installieren → Plugin hochladen* einspielen).
2. Im Backend unter *Plugins* «Split-Flap» aktivieren.

Es gibt keinen Build-Schritt. Der Block läuft build-frei über `wp.element` – kein npm, kein Webpack nötig. Voraussetzungen: WordPress 6.6+ und PHP 7.4+.

## Nutzung als Block

Es gibt zwei Blöcke (Kategorie *Medien*):

- **Split-Flap** – die einzeilige Tafel aus v1.
- **Split-Flap-Board** – das mehrzeilige Board mit Szenen, Farbflaps und Sound.

Beim Board legt die Redaktorin im Panel *Szenen* einen oder mehrere Szenen-Texte an (eine Eingabezeile = eine Board-Zeile, Farbflap mit `{1}`–`{15}`). Im Panel *Board* stehen Zeilen, Stellen und Grossschreibung, im Panel *Animation und Sound* das Loop-Intervall, Tempo und die Schrift, im Panel *Farbflaps* die 15 Farben. Die Vorschau zeigt die erste Szene statisch. Flip-Animation, Loop und Sound laufen erst im Frontend.

Ist eine Zeile länger als die Stellenzahl oder hat eine Szene mehr Zeilen als das Board, kürzt der Block und blendet im Editor einen Hinweis ein.

## Nutzung als Shortcode

Einzeilig (v1):

```text
[split_flap text="ABFAHRT" felder="7" tempo="normal"]
```

Board (v2):

```text
[split_flap_board
  scene1="ABFAHRT GLEIS 7|ZUG NACH BERN {1} 10:32|INTERCITY VERSPAETUNG"
  scene2="ANKUNFT GLEIS 3|ZUG AUS THUN {6} 10:48|REGIO PUENKTLICH"
  zeilen="6" stellen="25" intervall="6" tempo="normal"]
```

Pro Szene ein Attribut `sceneN`; innerhalb einer Szene trennt `|` die Board-Zeilen. Eine einzige Szene ergibt ein statisches Board ohne Wechsel und ohne Sound. Block und Shortcode teilen sich dieselbe Render-Funktion – das Frontend-Ergebnis ist identisch.

### Board-Shortcode-Parameter

| Parameter | Werte | Default | Wirkung |
|---|---|---|---|
| `scene1`, `scene2`, … | Text, Zeilen mit `\|` getrennt | – | Je ein Board-Zustand. Mehrere ergeben den Wechsel |
| `zeilen` | Zahl `1`–`30` | `6` | Anzahl Board-Zeilen |
| `stellen` | Zahl `1`–`60` | `25` | Stellen pro Zeile |
| `intervall` | Zahl `2`–`30` | `6` | Loop-Intervall in Sekunden (nur bei mehreren Szenen) |
| `tempo` | `langsam` / `normal` / `schnell` | `normal` | Tempo des Durchratterns pro Klappe |
| `farben` | 15 Hex-Werte, kommagetrennt | Default-Palette | Farben der `{1}`–`{15}`-Syntax |
| `schrift` | `mono` / `theme` | `mono` | Schriftbild der Klappe |
| `grossschrift` | `true` / `false` | `true` | Wandelt die Eingabe in Grossbuchstaben |
| `textfarbe` | Hex-Farbe | `#C8C8C8` | Farbe der Ziffern und Buchstaben |
| `klappenfarbe` | Hex-Farbe | `#1A1A1A` | Hintergrund der Klappe |

### Einzeilige Shortcode-Parameter

| Parameter | Werte | Default | Wirkung |
|---|---|---|---|
| `text` | beliebiger kurzer Text | leer | Der anzuzeigende Zieltext |
| `felder` | Zahl `0`–`60` | `0` | Feste Klappenzahl; `0` = automatisch (Länge des Textes). Kürzt oder füllt mit Leerklappen |
| `tempo` | `langsam` / `normal` / `schnell` | `normal` | Tempo des Durchratterns pro Klappe |
| `textfarbe` | Hex-Farbe | `#C8C8C8` | Farbe der Ziffern und Buchstaben |
| `klappenfarbe` | Hex-Farbe | `#1A1A1A` | Hintergrund der Klappe |
| `schrift` | `mono` / `theme` | `mono` | Schriftbild der Klappe |
| `grossschrift` | `true` / `false` | `true` | Wandelt die Eingabe in Grossbuchstaben |

## Die 15 Default-Farben

| Index | Name | Hex | Index | Name | Hex |
|---|---|---|---|---|---|
| 1 | Rot | `#E23B2E` | 9 | Hellblau | `#2D9CDB` |
| 2 | Orange | `#F08A24` | 10 | Blau | `#2D6CDF` |
| 3 | Bernstein | `#F4B400` | 11 | Indigo | `#4B47C4` |
| 4 | Gelb | `#FCE300` | 12 | Violett | `#8E44C4` |
| 5 | Limette | `#A8C700` | 13 | Magenta | `#D43BA8` |
| 6 | Grün | `#2EA84F` | 14 | Anthrazit | `#2B2B2B` |
| 7 | Smaragd | `#0F9D8C` | 15 | Weiss | `#F4F4F4` |
| 8 | Türkis | `#1FB6C1` | | | |

## Barrierefreiheit

- Der Zieltext steht für Screenreader als zusammenhängender String in einem visuell versteckten Element; die animierten Klappen tragen `aria-hidden`.
- Bei der Systemeinstellung *Bewegung reduzieren* (`prefers-reduced-motion: reduce`) zeigt das Board nur die erste Szene statisch – kein Loop, kein Sound.
- Der Ton-Toggle ist ein echtes `<button>` mit `aria-pressed` und beschreibendem Label, per Tastatur erreichbar und mit Enter oder Leertaste bedienbar. Sound ist nie Default-an und trägt keine Information.
- Der Default-Farbkontrast (Text `#C8C8C8` auf Klappe `#1A1A1A`) liegt bei rund 9:1 und damit über der Schwelle von 4.5:1.

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
| `includes/block.php` | Registrierung beider Blöcke über `block.json`, Render-Callbacks |
| `includes/shortcode.php` | Shortcodes `[split_flap]` und `[split_flap_board]`, Mapping auf die Render-Funktionen |
| `blocks/split-flap/` | Einzeiliger v1-Block (Metadaten, Editor) |
| `blocks/split-flap-board/` | Board-Block v2 (Metadaten, Editor) |
| `assets/css/split-flap.css` | Klappen-Stile, fallblatt-Look, Flip-Keyframes, Reduced-Motion |
| `assets/js/split-flap.js` | Board-Engine: IntersectionObserver, Szenen-Loop, Flip-Mechanik, Web-Audio-Sound |

## Scope-Grenze v2

Bewusst weiterhin nicht enthalten: Live-Datenfeed (Fahrpläne, Uhrzeit, RSS, APIs), Klick- oder Hover-Interaktion ausser dem Ton-Toggle, globale Settings-Seite, theme-übergreifendes Skin-System, Persistenz des Ton-Zustands über Seitenbesuche hinaus. Alle Optionen leben am Block beziehungsweise im Shortcode.

## Lizenz

GPL-2.0-or-later.
