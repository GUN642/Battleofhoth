#!/usr/bin/env python3
"""
Baut die Android-APK für "Battle of Hoth" ohne Android SDK / Gradle.

Benötigt nur: Python 3, ein JDK (javac/java/keytool) und Internet für den einmaligen
Download der Werkzeuge von Maven Central:
  - com.google.android:android:4.1.1.4      (android.jar zum Kompilieren)
  - com.jakewharton.android.repackaged:dalvik-dx (Java-Bytecode -> classes.dex)
  - com.android.tools.build:apksig          (APK-Signatur v2)
  - org.json:json                           (nur zum Kompilieren, org.json steckt in Android)

AndroidManifest.xml (binäres AXML) und resources.arsc (nur das App-Icon) werden von
diesem Skript direkt erzeugt. Ergebnis: dist/BattleOfHoth.apk

Aufruf:  python3 android/build_apk.py
"""
import json
import os
import shutil
import struct
import subprocess
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, 'android')
WEB = os.path.join(ROOT, 'web')
TOOLS = os.path.join(AND, '.tools')
BUILD = os.path.join(AND, 'build')
DIST = os.path.join(ROOT, 'dist')
OUT_APK = os.path.join(DIST, 'BattleOfHoth.apk')

PACKAGE = 'de.hoth.battle'
APP_LABEL = 'Battle of Hoth'
# Bei jedem neuen Release VERSION_CODE erhöhen: installierte Apps finden das Update dann
# automatisch über dist/version.json im GitHub-Repository.
VERSION_CODE = 2
VERSION_NAME = '1.1'
RELEASE_NOTES = [
    'Neue Grafik: Echtzeit-Schatten, PBR-Materialien, Bloom-Leuchten, Filmic-Tonemapping',
    'Detailliertere AT-AT, AT-ST, Schneegleiter, Geschütztürme und Soldaten',
    'Explosionen mit Lichtblitz, Brandspuren und Kamerawackeln',
    'Original-ähnliche Blaster-Sounds (dispersiver Stahlseil-Chirp) mit Stereo-Ortung',
    'Modernes HUD und Hauptmenü',
    'Automatische Update-Prüfung',
]
REPO_RAW = 'https://raw.githubusercontent.com/GUN642/Battleofhoth/HEAD'
MIN_SDK = 24   # Android 7.0+: reicht die v2-Signatur aus
TARGET_SDK = 34

KEYSTORE = os.path.join(AND, 'hoth-key.p12')
KEY_ALIAS = 'hoth'
KEY_PASS = 'battleofhoth'

MAVEN_MIRRORS = [
    'https://repo1.maven.org/maven2',
    'https://maven-central.storage-download.googleapis.com/maven2',
    'https://repo.maven.apache.org/maven2',
]
ARTIFACTS = {
    'android.jar': 'com/google/android/android/4.1.1.4/android-4.1.1.4.jar',
    'dx.jar': 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig.jar': 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
    'json.jar': 'org/json/json/20080701/json-20080701.jar',   # nur zum Kompilieren (org.json ist Teil von Android)
}


def run(cmd, **kw):
    print('  $', ' '.join(cmd))
    subprocess.run(cmd, check=True, **kw)


def fetch_tools():
    os.makedirs(TOOLS, exist_ok=True)
    for name, path in ARTIFACTS.items():
        dst = os.path.join(TOOLS, name)
        if os.path.exists(dst):
            continue
        for m in MAVEN_MIRRORS:
            try:
                print('  lade', m + '/' + path)
                with urllib.request.urlopen(m + '/' + path, timeout=60) as r:
                    data = r.read()
                with open(dst, 'wb') as f:
                    f.write(data)
                break
            except Exception as e:  # nächster Mirror
                print('    fehlgeschlagen:', e)
        else:
            sys.exit('Konnte %s nicht laden' % name)


# --------------------------------------------------------------------------- AXML
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b, 'versionName': 0x0101021c,
    'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280, 'hardwareAccelerated': 0x010102d3,
}
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
T_REF, T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def string_pool(strings):
    offsets, data = [], b''
    for s in strings:
        offsets.append(len(data))
        enc = s.encode('utf-16-le')
        data += struct.pack('<H', len(s)) + enc + b'\x00\x00'
    while len(data) % 4:
        data += b'\x00'
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    body = b''.join(struct.pack('<I', o) for o in offsets) + data
    return struct.pack('<HHIIIIII', 0x0001, header_size, header_size + len(body),
                       len(strings), 0, 0, strings_start, 0) + body


def build_manifest():
    # (tag, [(ns?, name, type, value)], children)
    A = True
    tree = ('manifest', [(A, 'versionCode', T_INT_DEC, VERSION_CODE), (A, 'versionName', T_STRING, VERSION_NAME),
                         (False, 'package', T_STRING, PACKAGE)], [
        ('uses-sdk', [(A, 'minSdkVersion', T_INT_DEC, MIN_SDK), (A, 'targetSdkVersion', T_INT_DEC, TARGET_SDK)], []),
        ('uses-permission', [(A, 'name', T_STRING, 'android.permission.INTERNET')], []),
        ('uses-permission', [(A, 'name', T_STRING, 'android.permission.REQUEST_INSTALL_PACKAGES')], []),
        ('application', [(A, 'label', T_STRING, APP_LABEL), (A, 'icon', T_REF, 0x7f010000),
                         (A, 'allowBackup', T_BOOL, True), (A, 'hardwareAccelerated', T_BOOL, True)], [
            ('activity', [(A, 'theme', T_REF, 0x01030007),  # @android:style/Theme.NoTitleBar.Fullscreen
                          (A, 'name', T_STRING, PACKAGE + '.MainActivity'),
                          (A, 'exported', T_BOOL, True),
                          (A, 'screenOrientation', T_INT_DEC, 6),     # sensorLandscape
                          (A, 'configChanges', T_INT_HEX, 0x0db0)],   # orientation|screenSize|keyboard...
             [('intent-filter', [], [
                 ('action', [(A, 'name', T_STRING, 'android.intent.action.MAIN')], []),
                 ('category', [(A, 'name', T_STRING, 'android.intent.category.LAUNCHER')], []),
             ])]),
        ]),
    ])

    # Strings sammeln: zuerst Attributnamen mit Ressourcen-ID (Reihenfolge = Resource-Map)
    res_names = []

    def walk(node, fn):
        fn(node)
        for c in node[2]:
            walk(c, fn)

    def collect_res(node):
        for ns, name, _, _ in node[1]:
            if ns and name not in res_names:
                res_names.append(name)
    walk(tree, collect_res)
    strings = list(res_names)

    def sidx(s):
        if s not in strings:
            strings.append(s)
        return strings.index(s)

    for s in ('android', ANDROID_NS):
        sidx(s)

    def collect_other(node):
        sidx(node[0])
        for ns, name, t, v in node[1]:
            sidx(name)
            if t == T_STRING:
                sidx(v)
    walk(tree, collect_other)

    NONE = 0xFFFFFFFF
    chunks = []
    ns_prefix, ns_uri = sidx('android'), sidx(ANDROID_NS)
    chunks.append(struct.pack('<HHIIIII', 0x0100, 16, 24, 1, NONE, ns_prefix, ns_uri))
    line = [1]

    def emit(node):
        tag, attrs, children = node
        line[0] += 1
        sorted_attrs = sorted(attrs, key=lambda a: (0, ATTR_IDS[a[1]]) if a[0] else (1, a[1]))
        ab = b''
        for ns, name, t, v in sorted_attrs:
            if t == T_STRING:
                raw, data = sidx(v), sidx(v)
            elif t == T_BOOL:
                raw, data = NONE, 0xFFFFFFFF if v else 0
            else:
                raw, data = NONE, v
            ab += struct.pack('<IIIHBBI', ns_uri if ns else NONE, sidx(name), raw, 8, 0, t, data)
        chunks.append(struct.pack('<HHIIIIIHHHHHH', 0x0102, 16, 36 + len(ab), line[0], NONE,
                                  NONE, sidx(tag), 20, 20, len(sorted_attrs), 0, 0, 0) + ab)
        for c in children:
            emit(c)
        line[0] += 1
        chunks.append(struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], NONE, NONE, sidx(tag)))
    emit(tree)
    chunks.append(struct.pack('<HHIIIII', 0x0101, 16, 24, line[0] + 1, NONE, ns_prefix, ns_uri))

    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(res_names)) + b''.join(
        struct.pack('<I', ATTR_IDS[n]) for n in res_names)
    body = pool + resmap + b''.join(chunks)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


# --------------------------------------------------------------------------- resources.arsc
def build_arsc(icon_path):
    gpool = string_pool([icon_path])
    type_pool = string_pool(['drawable'])
    key_pool = string_pool(['icon'])
    type_spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack('<I', 0)
    config = struct.pack('<I', 64) + b'\x00' * 60
    entries = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STRING, 0)
    type_hdr = 20 + len(config)
    type_chunk_body = config + struct.pack('<I', 0) + entries
    type_chunk = struct.pack('<HHIBBHII', 0x0201, type_hdr, 20 + len(type_chunk_body), 1, 0, 0, 1,
                             type_hdr + 4) + type_chunk_body
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\x00')
    pkg_hdr = 288
    pkg_body = type_pool + key_pool + type_spec + type_chunk
    pkg = struct.pack('<HHII', 0x0200, pkg_hdr, pkg_hdr + len(pkg_body), 0x7f) + name + struct.pack(
        '<IIIII', pkg_hdr, 1, pkg_hdr + len(type_pool), 1, 0) + pkg_body
    body = gpool + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body


# --------------------------------------------------------------------------- Icon
def make_icon(path):
    from PIL import Image, ImageDraw
    S = 192
    img = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(70 + 140 * t), int(110 + 115 * t), int(170 + 70 * t), 255))
    d.polygon([(0, 130), (60, 112), (120, 124), (192, 108), (192, 192), (0, 192)], fill=(236, 242, 248, 255))
    g = (78, 84, 92, 255)
    d.rectangle([62, 62, 140, 92], fill=g)            # Körper
    d.rectangle([140, 70, 152, 84], fill=g)           # Hals
    d.rectangle([150, 66, 176, 88], fill=g)           # Kopf
    d.rectangle([174, 84, 186, 87], fill=(40, 40, 40, 255))
    for x in (66, 84, 116, 132):                      # Beine
        d.rectangle([x, 90, x + 8, 150], fill=g)
        d.rectangle([x - 3, 148, x + 11, 155], fill=(60, 64, 70, 255))
    d.line([(10, 40), (70, 52)], fill=(255, 70, 40, 255), width=4)
    d.line([(120, 30), (182, 44)], fill=(90, 255, 70, 255), width=4)
    img.save(path)


def zip_apk(path, files):
    """files: Liste von (arcname, bytes, stored). Unkomprimierte Einträge werden auf 4 Byte ausgerichtet."""
    with zipfile.ZipFile(path, 'w') as z:
        for arc, data, stored in files:
            zi = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
            zi.create_system = 0
            zi.external_attr = 0
            if stored:
                zi.compress_type = zipfile.ZIP_STORED
                off = z.fp.tell() + 30 + len(arc.encode())
                pad = (-(off + 4)) % 4
                zi.extra = struct.pack('<HH', 0xD935, pad) + b'\x00' * pad
            else:
                zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data)


def check_alignment(path):
    with zipfile.ZipFile(path) as z, open(path, 'rb') as f:
        for zi in z.infolist():
            if zi.compress_type == zipfile.ZIP_STORED and zi.file_size:
                f.seek(zi.header_offset + 26)
                n, m = struct.unpack('<HH', f.read(4))
                off = zi.header_offset + 30 + n + m
                if off % 4:
                    sys.exit('Nicht ausgerichtet: %s' % zi.filename)


def main():
    print('[1/6] Werkzeuge')
    fetch_tools()
    android_jar, dx_jar, apksig_jar = (os.path.join(TOOLS, n) for n in ('android.jar', 'dx.jar', 'apksig.jar'))
    shutil.rmtree(BUILD, ignore_errors=True)
    os.makedirs(os.path.join(BUILD, 'classes'))
    os.makedirs(os.path.join(BUILD, 'signer'))
    os.makedirs(DIST, exist_ok=True)

    print('[2/6] Java kompilieren + dex')
    srcs = []
    for dp, _, fns in os.walk(os.path.join(AND, 'src')):
        srcs += [os.path.join(dp, f) for f in fns if f.endswith('.java')]
    # Stubs (z.B. @JavascriptInterface) nur zum Kompilieren, nicht ins dex
    stub_srcs = []
    for dp, _, fns in os.walk(os.path.join(AND, 'stubs')):
        stub_srcs += [os.path.join(dp, f) for f in fns if f.endswith('.java')]
    os.makedirs(os.path.join(BUILD, 'stubs'))
    run(['javac', '-nowarn', '--release', '8', '-d', os.path.join(BUILD, 'stubs')] + stub_srcs)
    json_jar = os.path.join(TOOLS, 'json.jar')
    run(['javac', '-nowarn', '--release', '8', '-cp', os.pathsep.join([android_jar, json_jar, os.path.join(BUILD, 'stubs')]),
         '-d', os.path.join(BUILD, 'classes')] + srcs)
    run(['java', '-cp', dx_jar, 'com.android.dx.command.Main', '--dex', '--min-sdk-version=%d' % MIN_SDK,
         '--output=' + os.path.join(BUILD, 'classes.dex'), os.path.join(BUILD, 'classes')])
    run(['javac', '-nowarn', '-cp', apksig_jar, '-d', os.path.join(BUILD, 'signer'), os.path.join(AND, 'Sign.java')])

    print('[3/6] Manifest, Ressourcen, Icon')
    icon_arc = 'res/drawable/icon.png'
    icon_file = os.path.join(BUILD, 'icon.png')
    make_icon(icon_file)
    files = [
        ('AndroidManifest.xml', build_manifest(), False),
        ('classes.dex', open(os.path.join(BUILD, 'classes.dex'), 'rb').read(), False),
        ('resources.arsc', build_arsc(icon_arc), True),
        (icon_arc, open(icon_file, 'rb').read(), True),
    ]
    for fn in sorted(os.listdir(WEB)):
        p = os.path.join(WEB, fn)
        if os.path.isfile(p):
            files.append(('assets/' + fn, open(p, 'rb').read(), False))

    print('[4/6] Zip')
    unsigned = os.path.join(BUILD, 'unsigned.apk')
    zip_apk(unsigned, files)
    check_alignment(unsigned)

    print('[5/6] Signieren')
    if not os.path.exists(KEYSTORE):
        run(['keytool', '-genkeypair', '-keystore', KEYSTORE, '-storetype', 'PKCS12', '-storepass', KEY_PASS,
             '-keypass', KEY_PASS, '-alias', KEY_ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-dname', 'CN=Battle of Hoth, O=Rebel Alliance, C=DE'])
    cp = os.pathsep.join([os.path.join(BUILD, 'signer'), apksig_jar])
    # apksig 2.3.0 nutzt interne JDK-Klassen -> für neuere JDKs freigeben
    jflags = ['--add-exports=java.base/%s=ALL-UNNAMED' % p for p in
              ('sun.security.x509', 'sun.security.pkcs', 'sun.security.util')]
    run(['java'] + jflags + ['-cp', cp, 'Sign', 'sign', KEYSTORE, KEY_PASS, KEY_ALIAS, str(MIN_SDK), unsigned, OUT_APK])

    print('[6/6] Prüfen')
    run(['java'] + jflags + ['-cp', cp, 'Sign', 'verify', OUT_APK])
    check_alignment(OUT_APK)
    with open(os.path.join(DIST, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump({'versionCode': VERSION_CODE, 'versionName': VERSION_NAME,
                   'apk': REPO_RAW + '/dist/BattleOfHoth.apk', 'notes': RELEASE_NOTES}, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('\nFertig: %s (%.1f MB), Version %s (%d)' % (OUT_APK, os.path.getsize(OUT_APK) / 1e6, VERSION_NAME, VERSION_CODE))


if __name__ == '__main__':
    main()
