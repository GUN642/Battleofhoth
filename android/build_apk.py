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
VERSION_CODE = 7
VERSION_NAME = '1.6'
RELEASE_NOTES = [
    'Neue Karte Endor: Waldmond mit Mammutbäumen, Farnen und Lichtstrahlen – im Menü unter „Karte“ wählbar',
    'Rebellen verteidigen den Bunkereingang, mit Han Solo, Chewbacca, R2-D2 und C-3PO',
    'Ewoks kämpfen mit Speeren und lösen Baumstammfallen gegen die AT-STs aus (auch per Hand mit E)',
    'Bunkergeschütze auf dem Dach, Imperium kann Sprengladungen am Bunkertor anbringen, auch im LAN-Mehrspieler',
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
    'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280, 'required': 0x0101028e,
    'hardwareAccelerated': 0x010102d3, 'banner': 0x010103f2, 'isGame': 0x010103f4,
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
        ('uses-permission', [(A, 'name', T_STRING, 'android.permission.CHANGE_WIFI_MULTICAST_STATE')], []),
        ('uses-permission', [(A, 'name', T_STRING, 'android.permission.ACCESS_WIFI_STATE')], []),
        # Android TV: kein Touchscreen nötig, Leanback (TV-Startbildschirm) optional
        ('uses-feature', [(A, 'name', T_STRING, 'android.hardware.touchscreen'), (A, 'required', T_BOOL, False)], []),
        ('uses-feature', [(A, 'name', T_STRING, 'android.software.leanback'), (A, 'required', T_BOOL, False)], []),
        ('uses-feature', [(A, 'name', T_STRING, 'android.hardware.gamepad'), (A, 'required', T_BOOL, False)], []),
        ('application', [(A, 'label', T_STRING, APP_LABEL), (A, 'icon', T_REF, 0x7f010000),
                         (A, 'banner', T_REF, 0x7f010001), (A, 'isGame', T_BOOL, True),
                         (A, 'allowBackup', T_BOOL, True), (A, 'hardwareAccelerated', T_BOOL, True)], [
            ('activity', [(A, 'theme', T_REF, 0x01030007),  # @android:style/Theme.NoTitleBar.Fullscreen
                          (A, 'name', T_STRING, PACKAGE + '.MainActivity'),
                          (A, 'exported', T_BOOL, True),
                          (A, 'screenOrientation', T_INT_DEC, 6),     # sensorLandscape
                          # orientation|screenSize|keyboard|keyboardHidden|navigation|...: kein Neustart,
                          # wenn z.B. ein Controller verbunden wird
                          (A, 'configChanges', T_INT_HEX, 0x0df0)],
             [('intent-filter', [], [
                 ('action', [(A, 'name', T_STRING, 'android.intent.action.MAIN')], []),
                 ('category', [(A, 'name', T_STRING, 'android.intent.category.LAUNCHER')], []),
                 ('category', [(A, 'name', T_STRING, 'android.intent.category.LEANBACK_LAUNCHER')], []),
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
def build_arsc(drawables):
    """drawables: Liste (Name, Pfad im APK); IDs 0x7f010000, 0x7f010001, ..."""
    n = len(drawables)
    gpool = string_pool([p for _, p in drawables])
    type_pool = string_pool(['drawable'])
    key_pool = string_pool([k for k, _ in drawables])
    type_spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4 * n, 1, 0, 0, n) + struct.pack('<I', 0) * n
    config = struct.pack('<I', 64) + b'\x00' * 60
    entries = b''.join(struct.pack('<HHI', 8, 0, i) + struct.pack('<HBBI', 8, 0, T_STRING, i) for i in range(n))
    offsets = b''.join(struct.pack('<I', i * 16) for i in range(n))
    type_hdr = 20 + len(config)
    type_chunk_body = config + offsets + entries
    type_chunk = struct.pack('<HHIBBHII', 0x0201, type_hdr, 20 + len(type_chunk_body), 1, 0, 0, n,
                             type_hdr + 4 * n) + type_chunk_body
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\x00')
    pkg_hdr = 288
    pkg_body = type_pool + key_pool + type_spec + type_chunk
    pkg = struct.pack('<HHII', 0x0200, pkg_hdr, pkg_hdr + len(pkg_body), 0x7f) + name + struct.pack(
        '<IIIII', pkg_hdr, 1, pkg_hdr + len(type_pool), 1, 0) + pkg_body
    body = gpool + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body


# --------------------------------------------------------------------------- Banner für Android TV (320x180)
def make_banner(path):
    from PIL import Image, ImageDraw, ImageFont
    W, H = 320, 180
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(40 + 120 * t), int(70 + 110 * t), int(120 + 100 * t)))
    d.polygon([(0, 130), (90, 112), (180, 126), (320, 104), (320, 180), (0, 180)], fill=(232, 238, 246))
    g = (70, 76, 86)
    d.rectangle([196, 70, 262, 96], fill=g); d.rectangle([262, 76, 272, 88], fill=g); d.rectangle([270, 72, 292, 92], fill=g)
    for x in (200, 214, 240, 252):
        d.rectangle([x, 94, x + 7, 142], fill=g); d.rectangle([x - 2, 140, x + 9, 146], fill=(55, 60, 68))
    d.line([(10, 36), (110, 56)], fill=(255, 70, 40), width=3)
    d.line([(210, 30), (300, 48)], fill=(90, 255, 70), width=3)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
        f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    except Exception:
        f = f2 = ImageFont.load_default()
    for dx, dy in ((2, 2),):
        d.text((16 + dx, 64 + dy), 'BATTLE', font=f, fill=(0, 0, 0))
        d.text((16 + dx, 96 + dy), 'OF HOTH', font=f, fill=(0, 0, 0))
    d.text((16, 64), 'BATTLE', font=f, fill=(255, 214, 110))
    d.text((16, 96), 'OF HOTH', font=f, fill=(255, 214, 110))
    d.text((18, 136), 'ECHO BASE', font=f2, fill=(40, 50, 70))
    img.save(path)


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
    banner_arc = 'res/drawable/banner.png'
    banner_file = os.path.join(BUILD, 'banner.png')
    make_banner(banner_file)
    files = [
        ('AndroidManifest.xml', build_manifest(), False),
        ('classes.dex', open(os.path.join(BUILD, 'classes.dex'), 'rb').read(), False),
        ('resources.arsc', build_arsc([('icon', icon_arc), ('banner', banner_arc)]), True),
        (icon_arc, open(icon_file, 'rb').read(), True),
        (banner_arc, open(banner_file, 'rb').read(), True),
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
