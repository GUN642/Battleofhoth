# Battle of Hoth – Ego-Shooter für Android

Ein 3D-First-Person-Shooter zur Schlacht von Hoth. Du verteidigst als Rebell Echo Base gegen
Sturmtruppen, AT-STs und AT-ATs, oder du greifst als Imperialer an und steuerst die Läufer selbst.

**Fertige APK:** [`dist/BattleOfHoth.apk`](dist/BattleOfHoth.apk) (Android 7.0 oder neuer, aktuelle Version siehe
[`dist/version.json`](dist/version.json))

## Installation
1. `dist/BattleOfHoth.apk` aufs Handy laden.
2. Installation aus „unbekannten Quellen“ für den Browser/Dateimanager erlauben.
3. APK antippen und installieren. Das Spiel läuft im Querformat und braucht kein Internet.

## Automatische Updates
Ab Version 1.1 prüft die App bei jedem Start, ob es eine neuere Version gibt. Dafür lädt sie
`dist/version.json` aus diesem Repository (Standard-Branch). Ist die dort eingetragene `versionCode` höher
als die installierte, erscheint im Hauptmenü der Dialog „Update verfügbar“. „Jetzt aktualisieren“ lädt die
neue APK herunter und öffnet den Android-Installer. Beim ersten Mal fragt Android, ob die App andere Apps
installieren darf. Das muss einmal erlaubt werden. Im Hauptmenü gibt es außerdem den Knopf „Nach Updates suchen“.

Version 1.0 hatte noch keine Update-Prüfung und muss einmalig von Hand durch 1.1 ersetzt werden.

**Neue Version veröffentlichen:** In `android/build_apk.py` `VERSION_CODE` erhöhen, `VERSION_NAME` und
`RELEASE_NOTES` anpassen, `python3 android/build_apk.py` ausführen und `dist/BattleOfHoth.apk` sowie
`dist/version.json` auf den Standard-Branch pushen. Installierte Apps finden das Update beim nächsten Start.

## Grafik & Sound
- PBR-Materialien mit Umgebungsreflexionen, Echtzeit-Schatten, HDR-Rendering mit Bloom (leuchtende Laser,
  Explosionen) und ACES-Filmic-Tonemapping
- Prozedurale Schnee- und Paneel-Texturen, detaillierte Modelle, Brandspuren, Lichtblitze, Kamerawackeln
- Grafikstufen: *Niedrig* (einfache Materialien, keine Schatten, kein Bloom), *Mittel* und *Hoch*
  (große Schattenkarte, Kantenglättung, volle Auflösung)
- Blaster-Sounds nach dem Prinzip des Originals: Ben Burtt schlug für Star Wars mit einem Hammer auf das
  Spannseil eines Funkmasts. Im Stahlseil laufen hohe Frequenzen schneller als tiefe, deshalb hört man einen
  fallenden „Pew“-Chirp. Das Spiel berechnet genau diesen dispersiven Chirp (f(t) = f0·(t0/(t+t0))²) samt
  Seil-Echo und metallischem Oberton, getrennt für Rebellen-Blaster, E-11, Geschütztürme, AT-ST, AT-AT und
  Schneegleiter, mit Stereo-Ortung und Dämpfung in der Ferne.

## Spielprinzip
- Schützengraben, Geschütztürme, Schildgenerator, Landeplattform mit Schneegleitern.
- **Jeder Blastertreffer tötet eine Person sofort**, egal ob Rebell, Sturmtruppler oder dich.
- **AT-ST und AT-AT** lassen sich nur mit **Geschütztürmen** oder **Schneegleitern** zerstören.
  Handblaster prallen an der Panzerung ab.
- Im Schneegleiter kannst du tief an ein AT-AT heranfliegen und das **Schleppkabel** abfeuern.
  Der Gleiter umkreist dann die Beine und bringt den Läufer zu Fall.
- **Visier:** Mit der rechten Maustaste (oder Q bzw. dem Touch-Knopf ZOOM) zoomst du heran. Zu Fuß blickst du
  durchs Zielfernrohr und triffst deutlich genauer als aus der Hüfte; in Türmen und Läufern wechselt die Sicht
  ins Cockpit.
- **Rebellen-KI** hat 3 Leben (einstellbar 1–5): Gefallene Rebellen kehren nach einigen Sekunden in den Graben
  zurück. Das HUD zeigt die Reserve als „+N“.
- **Seite Rebellen** – Sieg: alle imperialen Einheiten vernichtet. Niederlage: Schildgenerator zerstört oder
  keine Leben mehr.
- **Seite Imperium** – Du startest als Schneetruppler neben einem freien Läufer. Mit E steigst du in ein
  **AT-ST** (schnell, Doppelkanone) oder **AT-AT** (langsam, schwere Kanonen, aber anfällig für Schleppkabel).
  Laufen mit Joystick/W-S, drehen mit dem Blick oder A-D, zielen und feuern wie gewohnt. Geschütztürme und den
  Schildgenerator können nur die Läufer beschädigen. Sieg: Schildgenerator zerstört oder alle Verteidiger
  ausgeschaltet. Niederlage: Angriffsstreitmacht vernichtet oder keine Leben mehr.

### Karte Endor
Im Menü unter **Karte** lässt sich statt Hoth der Waldmond **Endor** wählen (gilt auch im Mehrspieler, der Host bestimmt die Karte).

- Riesige Mammutbäume, Farne, umgestürzte Stämme und Lichtstrahlen durch das Blätterdach. Baumstämme blockieren Sicht und Laserschüsse.
- Die Rebellen halten eine Linie aus liegenden Stämmen vor dem **imperialen Bunker**. **Han Solo** und **Chewbacca** kämpfen mit,
  **R2-D2** arbeitet am Schaltpult des Tors, **C-3PO** kommentiert das Geschehen.
- **Ewoks** (einstellbar 0–40) kämpfen im Wald mit Speeren. Sturmtruppen sehen sie im Farn erst aus der Nähe.
- **AT-STs** rücken über vier Waldwege an. Über den Wegen hängen **Ewok-Baumstammfallen**: Solange Ewoks in der Schlacht sind,
  lösen sie diese aus, wenn ein AT-ST darunter läuft. Als Rebell kannst du jede Falle auch selbst mit E auslösen.
  Nach etwa 45 Sekunden ist eine Falle wieder gespannt.
- Zwei **Bunkergeschütze** auf dem Dach (vom Tor aus mit E bemannen) sind die zweite Waffe gegen AT-STs.
- **Imperium:** Ziel ist das Bunkertor. AT-STs beschießen es, Sturmtruppen sprengen es auf, sobald die Linie fällt,
  und als Spieler kannst du am Tor eine **Sprengladung** anbringen (eine pro Leben). Sturmtruppen erhalten eine Welle Verstärkung.

### Karte Geonosis
Die dritte Karte zeigt die Schlacht um **Geonosis** aus den Klonkriegen: rote Wüste mit geonosianischen Felsnadeln, Tafelbergen,
Angriffsschiffen der Republik am Himmel und gelandeten Kernschiffen der Separatisten am Horizont.

- **Klonkrieger** (Seite Rebellen) verteidigen ihre **Kommandozentrale** in einem Felsbau, angeführt von **Captain Rex** (blau)
  und **Commander Cody** (orange). Klone schießen blau, Droiden rot.
- Die **Droidenarmee** (Seite Imperium) greift mit Kampfdroiden und **AAT-Schwebepanzern** an und erhält zwei Nachschubwellen.
  Als Droide kannst du einen AAT selbst steuern.
- AATs lassen sich nur mit **Geschütztürmen** oder **LAAT-Kanonenbooten** zerstören.
- **Kanonenboote:** Zwei stehen an der Landezone hinter der Linie (mit E einsteigen), weitere fliegen als KI. Gefallene Klone warten auf
  Transport: KI-Kanonenboote fliegen sie in Gruppen an die Front. Im eigenen Kanonenboot setzt du wartende Klone mit **F / Y / KABEL**
  ab, sobald du tiefer als 14 m fliegst – auch mitten im Gelände, um die Droiden zu flankieren.
- **Bordschütze:** Neben einem Kanonenboot mit **F / Y / SCHÜTZE** einsteigen. Du zielst frei und feuerst aus dem Kugelturm auf der
  Seite, in die du schaust: ein **grüner Dauerstrahl** wie im Film, der nach rund 4 Sekunden kurz abkühlen muss. Ideal im Mehrspieler: einer fliegt, der andere schießt. Allein startet nach wenigen Sekunden ein Klonpilot.
- Die Laser der Kanonenboote haben einen **Annäherungszünder**: Ein Schuss knapp neben einem Gegner ist ebenfalls tödlich,
  die Explosion trifft Infanterie im Umkreis von etwa 3,5 m.

### Waffen
Zu Fuß stehen vier Waffen zur Wahl (Rebellen / Imperium jeweils mit eigenem Modell). Die Waffenleiste unten
zeigt die aktive Waffe und die verbleibenden Thermaldetonatoren.

| # | Waffe | Eigenschaften |
|---|---|---|
| 1 | A280- / E-11-Blastergewehr | Allrounder, mittlere Feuerrate, Visier mit Zielfernrohr |
| 2 | Z-6-Rotationsblaster / DLT-19-Repetierblaster | sehr hohe Feuerrate, streut stärker, überhitzt schneller, Zoom ohne Zielfernrohr |
| 3 | DLT-20A- / E-11s-Präzisionsgewehr | langsam, schnelle Bolzen mit großer Reichweite, starkes Zielfernrohr, aus der Hüfte ungenau |
| 4 | Thermaldetonator | Wurfgranate im Bogen, prallt ab, explodiert nach ca. 2,4 s; tötet Soldaten im Umkreis, 3 pro Leben |

Jede Blasterwaffe hat ihre eigene Hitzeanzeige; beim Wechseln kühlen die anderen ab. Läufer bleiben auch gegen
Detonatoren immun – dafür braucht es weiterhin Türme oder Schneegleiter.

Im Hauptmenü lässt sich einstellen: Karte (Hoth, Endor oder Geonosis), Anzahl der Rebellen (dein Team), Ewoks (Endor), Sturmtruppen, AT-ST,
AT-AT und KI-Schneegleiter (Hoth), Geschütztürme bzw. Bunkergeschütze, deine Leben, Schwierigkeit, Blick-Empfindlichkeit und Grafik.

### Steuerung
| | Touch | PC |
|---|---|---|
| Bewegen | linke Bildschirmhälfte ziehen (ganz ausgelenkt = sprinten) | WASD, Shift = sprinten |
| Zielen | rechte Bildschirmhälfte wischen | Maus |
| Feuern | FEUER halten (dabei weiter zielen) | Linksklick |
| Visier/Zoom | ZOOM | rechte Maustaste halten oder Q |
| Turm/Gleiter/Läufer benutzen, aussteigen | E | E |
| Schleppkabel | KABEL | F |
| Waffe wählen | Waffenleiste unten antippen | 1–4 oder Mausrad |
| Schub im Gleiter | Joystick vor/zurück | W/S |
| Pause | II oder Zurück-Taste | Esc |

### Zielhilfe
Mit Controller oder Touch wird das Fadenkreuz über Gegnern langsamer und folgt ihnen sanft. Ist es rot, ist das Ziel erfasst und
die Schüsse fliegen genau dorthin. Im Menü unter **Zielhilfe**: „Aus“, „Controller & Touch“ (Standard) oder „Immer“ (auch mit Maus).

### Controller & Android TV
Das Spiel läuft auch auf Android TV und lässt sich komplett mit einem Controller spielen (z. B. Nintendo-Switch-,
Xbox- oder PlayStation-Controller per Bluetooth). Es erscheint mit Banner auf dem TV-Startbildschirm.

| Aktion | Controller |
|---|---|
| Bewegen / Läufer laufen lassen | linker Stick |
| Zielen / drehen | rechter Stick |
| Feuern | ZR / R (R2 / R1) |
| Visier/Zoom | ZL / L halten, X umschalten |
| Springen | A |
| Benutzen / einsteigen / aussteigen | B |
| Waffe wechseln | Y (zu Fuß) oder Steuerkreuz links/rechts |
| Schleppkabel | Y (im Schneegleiter) |
| Sprinten | linken Stick drücken |
| Pause | + oder − |

Im Menü: Steuerkreuz bzw. Stick **hoch/runter** blättert durch die Einträge, **links/rechts** ändert den Wert
(oder wechselt zwischen nebeneinanderliegenden Knöpfen), **A** bzw. **OK** bestätigt, **B** geht zurück, **+** startet
die Schlacht. Mit der TV-Fernbedienung funktioniert das genauso. Die Tasten folgen standardmäßig der
**Nintendo-Beschriftung** (A = rechte Taste). Für Xbox- oder PlayStation-Controller im Menü unter „Controller-Tasten“
auf „Xbox / PlayStation“ umstellen.

## Mehrspieler im lokalen Netzwerk
Alle Geräte mit der App im selben WLAN bzw. Heimnetz (Handys, Tablets, Android TV) können gemeinsam spielen:

1. Im Hauptmenü **Mehrspieler (LAN)** wählen, Namen und Seite (Rebellen oder Imperium) einstellen.
2. Ein Gerät tippt **Spiel eröffnen** – es wird zum Host. Seine Einstellungen (Truppenzahl, Leben, Schwierigkeit)
   gelten für alle.
3. Die anderen sehen das Spiel unter **Gefundene Spiele** und treten bei (oder geben die angezeigte IP-Adresse des
   Hosts von Hand ein).
4. Der Host startet die Schlacht. Spieler können auch in eine laufende Schlacht einsteigen.

Rebellen und Imperium können gemischt besetzt sein, die übrigen Einheiten steuert die KI. Jeder Spieler hat eigene
Leben; wer keine mehr hat, schaut der Schlacht weiter zu. Der Host berechnet die Schlacht und sendet den Spielstand
etwa 15-mal pro Sekunde (TCP-Port 47780, Spielsuche per UDP-Broadcast auf Port 47781). Verlässt der Host das Spiel,
endet die Runde für alle. Gäste-WLANs mit „Client-Isolation“ verhindern die Verbindung zwischen Geräten.
Der Mehrspieler funktioniert nur in der Android-App, nicht in der Browser-Version.

## Projektaufbau
- `web/`: das Spiel (HTML5/WebGL mit [three.js](https://threejs.org) r149, ohne weitere Abhängigkeiten).
  Zum Testen am PC `web/index.html` direkt im Browser öffnen.
  - `world.js` Gelände, Texturen, Materialien, Himmel, Effekte · `audio.js` Sound-Synthese ·
    `units.js` Einheiten, KI, Laser · `post.js` Bloom/Tonemapping · `game.js` Spieler, HUD, Menü ·
    `nav.js` Controller & Menü-Navigation · `net.js` LAN-Mehrspieler · `endor.js` Karte Endor (Wald, Bunker, Helden, Ewoks, Fallen) ·
    `geonosis.js` Karte Geonosis (Wüste, Klone, Droiden, AAT, Kanonenboote) ·
    `update.js` Update-Dialog
  - Mehrspieler im Browser testen: `web/` über einen lokalen Webserver öffnen und in zwei Fenstern
    `index.html?net=test` aufrufen (Transport über BroadcastChannel)
- `android/`: Android-App (Vollbild-WebView, lädt `web/` aus den Assets, Update-Prüfung, Controller-Weiterleitung,
  `LanNet.java` für den LAN-Mehrspieler) und Build-Skript.
- `dist/BattleOfHoth.apk`: die fertig gebaute und signierte APK, `dist/version.json`: Versionsinfo für die Update-Prüfung.

## APK selbst bauen
Voraussetzungen: Python 3 mit Pillow, ein JDK (17 oder neuer) und Internet für den einmaligen
Download der Werkzeuge von Maven Central. Ein Android SDK oder Gradle ist nicht nötig.

```sh
python3 android/build_apk.py
```

Das Skript kompiliert `MainActivity.java`, wandelt sie mit `dx` in `classes.dex` um, erzeugt das
binäre `AndroidManifest.xml` und `resources.arsc` selbst, packt `web/` als Assets ein und signiert die
APK mit `apksig` (APK Signature Scheme v2).

`android/hoth-key.p12` ist ein öffentlicher Test-Schlüssel (Passwort steht im Build-Skript). Er sorgt
dafür, dass neue Builds sich über alte installieren lassen. Für eine Veröffentlichung im Play Store
solltest du einen eigenen, geheimen Schlüssel verwenden.

*Fan-Projekt ohne Verbindung zu Lucasfilm/Disney. Star Wars ist eine Marke von Lucasfilm Ltd.*
