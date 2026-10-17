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

Im Hauptmenü lässt sich einstellen: Anzahl der Rebellen (dein Team), Sturmtruppen, AT-ST, AT-AT,
KI-Schneegleiter, Geschütztürme, deine Leben, Schwierigkeit, Blick-Empfindlichkeit und Grafik.

### Steuerung
| | Touch | PC |
|---|---|---|
| Bewegen | linke Bildschirmhälfte ziehen (ganz ausgelenkt = sprinten) | WASD, Shift = sprinten |
| Zielen | rechte Bildschirmhälfte wischen | Maus |
| Feuern | FEUER halten (dabei weiter zielen) | Linksklick |
| Visier/Zoom | ZOOM | rechte Maustaste halten oder Q |
| Turm/Gleiter/Läufer benutzen, aussteigen | E | E |
| Schleppkabel | KABEL | F |
| Schub im Gleiter | Joystick vor/zurück | W/S |
| Pause | II oder Zurück-Taste | Esc |

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
| Schleppkabel | Y |
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
    `nav.js` Controller & Menü-Navigation · `net.js` LAN-Mehrspieler · `update.js` Update-Dialog
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
