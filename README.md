# Split-Flap

Animierte Fallblattanzeige für WordPress – die klassische Split-Flap-Tafel aus Bahnhof und Flughafen, als Gutenberg-Block und als Shortcode. Reines PHP, Vanilla JS und CSS, ohne Drittanbieter-Bibliothek.

Internes Experiment von Blitz & Donner. Kein Kundenprojekt.

## Zweck

Eine Redaktorin setzt einen kurzen Text. Das Plugin rendert ihn als Reihe mechanischer Klappen, die beim Erscheinen im Viewport vom Startzustand zum Zieltext durchrattern und versetzt von links nach rechts stoppen.

Ab Version 0.2.0 gibt es zwei Anzeigen: die einzeilige Tafel aus v1 und ein mehrzeiliges **Board** (Departure-Board) mit automatischem Szenen-Wechsel und Farbflaps.

## Das Board (v2)

Das Board ist eine Abfahrtstafel mit fester Zeilen- und Stellenzahl, Default **6 Zeilen × 25 Stellen** (150 Klappen). Es hält eine oder mehrere **Szenen**; bei mehr als einer Szene wechselt es automatisch in einem Intervall durch. Im Standard-Stil «sequenziell» rattern nur die geänderten Stellen versetzt von links nach rechts.

Das eingestellte Intervall ist eine Untergrenze, kein starrer Takt. Die Engine startet den nächsten Wechsel erst, wenn der vorige vollständig abgeschlossen ist und das Board kurz geruht hat. Das **effektive Intervall** ist deshalb `max(eingestelltes Intervall, längste Animationsdauer + Ruhepuffer)`. So kollidiert ein Wechsel nie mit einer noch laufenden Animation – auch bei Intervall 2 s und 150 geänderten Stellen zeigt das Board zwischen den Wechseln immer ein klares, scharfes Bild.

### Farbflaps

Im Text setzt die Syntax `{1}` bis `{15}` einen farbigen Block. Jede Markierung belegt genau eine Stelle. `{0}`, `{16}` und höher, `{}` oder Unfug wie `{ab}` werden zur Leer-Klappe – kein Fehler. Die 15 Farben sind pro Board frei wählbar (15 Color-Picker im Block, Attribut `farben` im Shortcode); fehlt oder stimmt eine Farbe nicht, greift die Default-Palette.

### Visuelle Herkunft

Die Optik orientiert sich am Projekt **roosterfish/fallblatt** – übernommen wurde der Look (Schrift Overpass Mono, helles Grau auf dunklen Klappen, horizontaler Mittelspalt mit seitlichen Achsstummeln als Scharniere, dunkles Anthrazit). Der jQuery-Code der Referenz wurde **nicht** übernommen; das Plugin bleibt bei eigener Vanilla-JS-Umsetzung ohne Drittbibliothek.

### Zeichensatz

Jede Klappe stellt A–Z, 0–9, das Leerzeichen und elf Sonderzeichen dar: `+ - . , – % & * ? ! /`. Bindestrich/Minus «-» (U+002D) und Halbgeviertstrich «–» (U+2013) sind zwei verschiedene, jeweils erlaubte Zeichen. Zeichen ausserhalb dieser Liste werden zur Leer-Klappe – kein Fehler. Beim animierten Wechsel laufen die Sonderzeichen als Teil des Rings mit durch.

### Animationsstil

Der Block- und Shortcode-Parameter `stil` steuert den Szenenwechsel:

- **Sequenziell (versetzt)** – Default, Wert `sequenziell`. Nur geänderte Stellen klappen, versetzt von links nach rechts, mit gewürfelten Zwischenschritten. Verhalten unverändert gegenüber früheren Versionen.
- **Synchron farbig** – Wert `synchron`. Beim Wechsel klappen **alle** Stellen gleichzeitig. Sie starten im selben Moment bei Farbflap 1 und durchlaufen denselben vollständigen Ring (15 Farben c1…c15, dann die 48 Zeichen-Positionen) im selben Takt; jede Klappe stoppt bei ihrem Zielzeichen. So entsteht eine farbige Welle mit gestaffeltem Ende. Der Takt ist gedeckelt, sodass der längste Durchlauf bei Tempo «normal» rund 2.5 s nicht überschreitet. Der Erstaufbau bleibt in beiden Stilen sequenziell; der synchrone Vollring greift erst ab dem ersten Szenenwechsel.

Bei *Bewegung reduzieren* (`prefers-reduced-motion: reduce`) zeigt das Board in beiden Stilen nur die erste Szene statisch – kein Loop, kein Durchlauf.

## Installation

1. Den Ordner `split-flap` nach `wp-content/plugins/` kopieren (oder als ZIP über *Plugins → Installieren → Plugin hochladen* einspielen).
2. Im Backend unter *Plugins* «Split-Flap» aktivieren.

Es gibt keinen Build-Schritt. Der Block läuft build-frei über `wp.element` – kein npm, kein Webpack nötig. Voraussetzungen: WordPress 6.6+ und PHP 7.4+.

## Nutzung als Block

Es gibt zwei Blöcke (Kategorie *Medien*):

- **Split-Flap** – die einzeilige Tafel aus v1.
- **Split-Flap-Board** – das mehrzeilige Board mit Szenen und Farbflaps.

Beim Board legt die Redaktorin im Panel *Szenen* einen oder mehrere Szenen-Texte an (eine Eingabezeile = eine Board-Zeile, Farbflap mit `{1}`–`{15}`). Hat das Board mehrere Szenen, blendet das Panel eine Knopfreihe *Szene 1*, *Szene 2* … ein: Der gewählte Knopf schaltet sowohl die Vorschau als auch das Textfeld auf diese Szene um, sodass die Redaktorin jede Szene einzeln sieht und bearbeitet. Im Panel *Board* stehen Zeilen, Stellen und Grossschreibung, im Panel *Animation* das Loop-Intervall, Tempo, der Animationsstil und die Schrift, im Panel *Farbflaps* die 15 Farben. Die Vorschau aktualisiert sich beim Tippen live und zeigt die jeweils gewählte Szene statisch. Flip-Animation und Loop laufen erst im Frontend.

Ist eine Zeile länger als die Stellenzahl oder hat eine Szene mehr Zeilen als das Board, kürzt der Block und blendet im Editor einen Hinweis ein.

### Ausrichtung «breit» und «voll»

Beide Blöcke kennen die Gutenberg-Ausrichtungen «breit» und «volle Breite» (Buttons in der Block-Toolbar). Sie heben die Obergrenze der Klappengrösse an, sodass die Tafel den verfügbaren Raum nutzt:

| Ausrichtung | Obergrenze pro Klappe |
|---|---|
| Standard (keine, links, zentriert, rechts) | 2.1rem |
| Breit (`alignwide`) | 3.2rem |
| Voll (`alignfull`) | 4.6rem |

Die Höhe folgt automatisch proportional aus der Breite (Höhe = Breite × 1.5), die Schrift bleibt an die Höhe gekoppelt. Klappen, Höhe und Schrift wachsen also im selben Verhältnis – das Seitenverhältnis bleibt unverändert, nichts wird gestaucht oder abgeschnitten. Wachsen die Klappen über den Containerraum hinaus, greift die Obergrenze: Die Tafel zentriert sich dann mit Rand, statt sich über die ganze Breite zu dehnen. Wenige Stellen auf voller Breite ergeben so keine riesigen, gedehnten Klappen, sondern eine zentrierte Tafel. Auf schmalen Viewports bleiben die Klappen unter der Obergrenze – die Container Query hält sie ohne horizontalen Überlauf im Container.

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
  zeilen="6" stellen="25" intervall="6" tempo="normal" stil="synchron"]
```

Pro Szene ein Attribut `sceneN`; innerhalb einer Szene trennt `|` die Board-Zeilen. Eine einzige Szene ergibt ein statisches Board ohne Wechsel. Block und Shortcode teilen sich dieselbe Render-Funktion – das Frontend-Ergebnis ist identisch.

### Board-Shortcode-Parameter

| Parameter | Werte | Default | Wirkung |
|---|---|---|---|
| `scene1`, `scene2`, … | Text, Zeilen mit `\|` getrennt | – | Je ein Board-Zustand. Mehrere ergeben den Wechsel |
| `zeilen` | Zahl `1`–`30` | `6` | Anzahl Board-Zeilen |
| `stellen` | Zahl `1`–`60` | `25` | Stellen pro Zeile |
| `intervall` | Zahl `2`–`30` | `6` | Loop-Intervall in Sekunden (nur bei mehreren Szenen) |
| `tempo` | `langsam` / `normal` / `schnell` | `normal` | Tempo des Durchratterns pro Klappe |
| `stil` | `sequenziell` / `synchron` | `sequenziell` | Animationsstil des Szenenwechsels (siehe Abschnitt Animationsstil) |
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
- Bei der Systemeinstellung *Bewegung reduzieren* (`prefers-reduced-motion: reduce`) zeigt das Board in beiden Animationsstilen nur die erste Szene statisch – kein Loop, kein Durchlauf.
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
| `assets/js/split-flap.js` | Board-Engine: IntersectionObserver, Szenen-Loop, Flip-Mechanik (sequenziell und synchron) |

## Scope-Grenze v2

Bewusst weiterhin nicht enthalten: Live-Datenfeed (Fahrpläne, Uhrzeit, RSS, APIs), Klick- oder Hover-Interaktion, globale Settings-Seite, theme-übergreifendes Skin-System. Alle Optionen leben am Block beziehungsweise im Shortcode.

## Changelog

### 0.3.3

- Klappen-Seitenverhältnis von 1.5 auf 1.34 angeglichen (Höhe = Breite × 1.34). Das entspricht dem echten Fallblatt (Referenz rund 120/90 ≈ 1.33) und gilt einheitlich für alle Ausrichtungen (Standard, breit, voll) und beide Blöcke. **Bestehende Tafeln werden dadurch sichtbar flacher.** Das ist eine bewusste, freigegebene optische Änderung, keine stille Regression. Die Klappenbreite und die Obergrenzen (2.1/3.2/4.6rem) bleiben unverändert; nur die Höhe sinkt. Die Schrift hängt an der Klappenhöhe (`--sf-font-size` = Höhe × Faktor).
- Schrift kräftiger und optisch zentriert: Schriftfaktor von 0.66 über 0.72 auf 0.74 erhöht. Zuvor zentrierte die Klappe die Font-Linienbox, nicht die sichtbare Tinte – bei `line-height: 1` reserviert Overpass Mono unter der Grundlinie Platz für Unterlängen (g, y, p), den Versalien und Ziffern nicht nutzen; die Tinte sass dadurch zu hoch, unten blieb eine sichtbare Lücke. Gemessen beträgt diese Asymmetrie rund 0.24 em. Ein Verschieben der Glyphe um 0.12 em nach unten (Variable `--sf-ink-nudge`, wirkt gleich auf statisches Zeichen und Flip-Glyph) stellt Tinten-Ober- und -Unterkante symmetrisch zur Klappe. Gemessen sinkt die Rest-Asymmetrie der Grossbuchstaben von rund 4–8 px auf unter 1 px (Desktop, breit, Mobile 360/390 px). Weil die Tinte nun mittig steht, durfte der Faktor von 0.72 auf 0.74 steigen, ohne die Kante zu berühren: kleinster realer Rest-Abstand rund 2.0 px (Komma, Mobile 390 px), Grossbuchstaben rund 2.4 px und mehr. Kein Überstand, kein Abschneiden – im Ruhezustand wie im Umklappen. Klappen flacher (1.34) und Schrift kräftiger, mittig gesetzt liefern zusammen den fallblatt-treuen Look.
- Naht durch die Buchstaben: Der Mittelspalt liegt bei Buchstaben-Klappen nicht mehr hinter der blickdichten Glyphe (dort war er verdeckt), sondern wird per `background-clip: text` durch die Glyphe selbst gemalt – der Buchstabe wirkt am Spalt unterbrochen, wie die Farbflaps. Die volle Klappen-Naht bleibt auf der Zellfläche (auch bei Leerklappen), exakt auf 50 % und deckungsgleich mit der Trennlinie der Flip-Hälften und der Glyphen-Naht. Ein einfacher Fallback zeigt in Browsern ohne `background-clip: text` die Glyphe schlicht in der Textfarbe ohne Naht.

### 0.3.2

- Sound vollständig entfernt: kein synthetischer Klappersound, kein Ton-Toggle, keine Web-Audio-Nutzung mehr. Das Custom-Event `splitflap:flip` am Board-Element bleibt als Erweiterungsstelle erhalten.
- Zeichensatz um elf Sonderzeichen erweitert: `+ - . , – % & * ? ! /`. Bindestrich/Minus «-» (U+002D) und Halbgeviertstrich «–» (U+2013) sind zwei verschiedene, jeweils erlaubte Zeichen. Sie erscheinen auch im animierten Durchlauf.
- Neuer Animationsstil-Schalter `stil` (Block, Shortcode, Editor-Panel *Animation*). «Sequenziell (versetzt)» bleibt Default und verhält sich unverändert. «Synchron farbig» lässt beim Szenenwechsel alle Klappen gleichzeitig bei Farbflap 1 starten und durch den vollständigen Ring (15 Farben, dann 48 Zeichen) laufen; jede stoppt bei ihrem Ziel. Der Takt ist gedeckelt, sodass der längste Durchlauf bei Tempo «normal» rund 2.5 s nicht überschreitet. *Bewegung reduzieren* gilt in beiden Stilen.

### 0.3.1

- Ausrichtung «volle Breite» (`alignfull`) erzwingt jetzt echte Vollbreite über den ganzen Viewport – theme-unabhängig. Themes wie Twenty-Twenty-Five setzen `alignfull` nur über negative Margins bis zur Container-Breite um; die Tafel blieb dann asymmetrisch und nahm nicht die volle Breite ein. Der dunkle Tafelrahmen spannt sich nun zuverlässig über die ganze sichtbare Breite. Der Klappen-Inhalt bleibt mittig mit Rand (Obergrenze 4.6rem unverändert).
- Scrollbar-sicher gelöst: Ein kleines Frontend-Skript misst die echte Innenbreite (`document.documentElement.clientWidth`, ohne vertikale Scrollbar) und legt sie als CSS-Variable `--sf-vw` ab. So entsteht kein horizontaler Überlauf – im Gegensatz zu reinem `100vw`, das die Scrollbar-Breite mitzählt. Auf Mobile (360 px, 390 px) bleibt das Board ohne horizontalen Scroll. Das Skript läuft nur, wenn eine `alignfull`-Tafel vorhanden ist, und entprellt Resize-Ereignisse.

### 0.3.0

- Ausrichtung «breit» (`alignwide`) und «volle Breite» (`alignfull`) für beide Blöcke. Die Buttons stehen in der Block-Toolbar; je Ausrichtung steigt die Obergrenze der Klappengrösse (2.1rem Standard, 3.2rem breit, 4.6rem voll). Höhe und Schrift folgen proportional aus der Breite (Verhältnis Höhe = Breite × 1.5 unverändert) – die Klappen wachsen mit, ohne Stauchung oder Verzerrung. Bestehende Tafeln ohne Ausrichtung bleiben optisch identisch.
- Die align-Klasse landet im Frontend aktiv auf dem `.split-flap`-Container. Bei `render_callback`-Blöcken hängt WordPress sie nicht automatisch an; der Render-Callback setzt sie nun selbst aus dem Block-Attribut. So greift das Ausrichtungs-CSS auch im Frontend, nicht nur im Editor.

### 0.2.2

- Robuster Szenen-Loop: Der nächste Wechsel startet erst, wenn der vorige vollständig abgeschlossen ist und das Board mindestens 800 ms geruht hat. Das effektive Intervall ist `max(eingestelltes Intervall, längste Animationsdauer + Ruhepuffer)`. Damit kollidiert kein Wechsel mehr mit einer laufenden Animation; zwischen den Wechseln gibt es immer ein messbares Ruhefenster, in dem das Board scharf steht. Gemessen bei Intervall 2 s mit zwei stark unterschiedlichen Szenen (99 umklappende Stellen je Wechsel): Ruhefenster rund 900 ms, keine Akkumulation laufender Animationen.
- Block-Editor produktionsreif: Bei mehreren Szenen schaltet eine Knopfreihe *Szene 1*, *Szene 2* … Vorschau und Textfeld gemeinsam auf die gewählte Szene um. Die Vorschau aktualisiert sich beim Tippen live. Alle Controls (Szenen anlegen/entfernen/umschalten, Zeilen, Stellen, Tempo, Intervall, Grossschreibung, Schrift, 15 Farb-Picker) ohne Konsolenfehler bedienbar; Speichern und erneutes Öffnen erhält alle Werte.
- Übersetzungsvorlage `languages/split-flap.pot` um alle v2-Strings ergänzt (Board-Editor-Labels, Panel-Titel, Hinweistexte, Ton-Toggle-Labels).

### 0.2.1

- Behebt den DOM-Leak der Animations-Engine: Jeder Szenenwechsel bricht eine noch laufende Klappen-Animation sauber ab – vorgemerkte Timeouts werden gecancelt, alte Flip-Hälften entfernt. Im Ruhezustand existieren pro Klappe genau 0 Flip-Hälften, das Board kommt nach jeder Szene zur Ruhe.
- Behebt den horizontalen Überlauf: Die Klappenbreite bindet jetzt per CSS Container Query (`container-type: inline-size`, Breite in `cqw`) an den verfügbaren Containerraum statt an den Viewport. Das Board passt in jedem Theme und auf Mobile ohne Scrollbar in seinen Container.
- Board zentriert die Klappen, statt linksbündig zu sitzen.
- Ton-Toggle-Icon vergrössert (klar erkennbar, Button-Target bleibt 28×28px).

### 0.2.0

- Mehrzeiliges Board mit automatischem Szenen-Wechsel, Farbflaps und synthetischem Klappersound. Einzeilige v1-Anzeige bleibt als Sonderfall erhalten.

## Lizenz

GPL-2.0-or-later.
