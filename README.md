# Battle of Hoth – Ego-Shooter für Android

Ein einfacher 3D-First-Person-Shooter zur Schlacht von Hoth. Du kämpfst auf der Seite der
Rebellen und verteidigst Echo Base gegen Sturmtruppen, AT-STs und AT-ATs.

**Fertige APK:** [`dist/BattleOfHoth.apk`](dist/BattleOfHoth.apk) (Android 7.0 oder neuer)

## Installation
1. `dist/BattleOfHoth.apk` aufs Handy laden.
2. Installation aus „unbekannten Quellen“ für den Browser/Dateimanager erlauben.
3. APK antippen und installieren. Das Spiel läuft im Querformat und braucht kein Internet.

## Spielprinzip
- Schützengraben, Geschütztürme, Schildgenerator, Landeplattform mit Schneegleitern.
- **Jeder Blastertreffer tötet eine Person sofort**, egal ob Rebell, Sturmtruppler oder dich.
- **AT-ST und AT-AT** lassen sich nur mit **Geschütztürmen** oder **Schneegleitern** zerstören.
  Handblaster prallen an der Panzerung ab.
- Im Schneegleiter kannst du tief an ein AT-AT heranfliegen und das **Schleppkabel** abfeuern.
  Der Gleiter umkreist dann die Beine und bringt den Läufer zu Fall.
- Sieg: Alle imperialen Einheiten sind vernichtet. Niederlage: Der Schildgenerator wird zerstört
  oder du hast keine Leben mehr.

Im Hauptmenü lässt sich einstellen: Anzahl der Rebellen (dein Team), Sturmtruppen, AT-ST, AT-AT,
KI-Schneegleiter, Geschütztürme, deine Leben, Schwierigkeit, Blick-Empfindlichkeit und Grafik.

### Steuerung
| | Touch | PC |
|---|---|---|
| Bewegen | linke Bildschirmhälfte ziehen (ganz ausgelenkt = sprinten) | WASD, Shift = sprinten |
| Zielen | rechte Bildschirmhälfte wischen | Maus |
| Feuern | FEUER halten (dabei weiter zielen) | Linksklick |
| Turm/Gleiter benutzen, aussteigen | E | E |
| Schleppkabel | KABEL | F |
| Schub im Gleiter | Joystick vor/zurück | W/S |
| Pause | II oder Zurück-Taste | Esc |

## Projektaufbau
- `web/`: das Spiel (HTML5/WebGL mit [three.js](https://threejs.org) r149, ohne weitere Abhängigkeiten).
  Zum Testen am PC `web/index.html` direkt im Browser öffnen.
- `android/`: minimale Android-App (Vollbild-WebView, lädt `web/` aus den Assets) und Build-Skript.
- `dist/BattleOfHoth.apk`: die fertig gebaute und signierte APK.

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
