'use strict';
// ============================================================================
//  Battle of Hoth - Automatische Update-Prüfung
//  Die Android-App (window.HothApp, siehe MainActivity.java) lädt beim Start
//  dist/version.json aus dem GitHub-Repository. Gibt es eine neuere Version,
//  zeigt das Hauptmenü einen Dialog; "Jetzt aktualisieren" lädt die APK herunter
//  und öffnet den Android-Installer.
// ============================================================================
(function () {
  const App = window.HothApp;
  const st = { info: null, manual: false, dismissed: false, busy: false, downloaded: false };
  const modal = $('updModal'), btn = $('updBtn'), go = $('updGo'), later = $('updLater');

  function setVer(extra) {
    if (!App) return;
    $('verLabel').textContent = 'Version ' + App.versionName() + (extra ? ' · ' + extra : '');
  }
  if (App) { setVer(''); btn.classList.remove('hidden'); }

  function show() {
    const i = st.info;
    if (!i) return;
    $('updText').textContent = `Version ${i.versionName} ist da (installiert: ${App.versionName()}).`;
    const ul = $('updNotes'); ul.innerHTML = '';
    (i.notes || []).forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.append(li); });
    $('updProg').classList.add('hidden'); $('updBar').style.width = '0';
    go.disabled = false; go.textContent = 'Jetzt aktualisieren';
    modal.classList.remove('hidden');
  }
  function maybeShow() {
    if (!st.info || st.busy) return;
    if (st.manual || (!st.dismissed && window.__hoth && __hoth.state === 'menu')) { st.manual = false; show(); }
  }
  // Wenn ein Update während eines Gefechts gefunden wird: im nächsten Hauptmenü anzeigen
  setInterval(maybeShow, 1500);

  window.hothUpdateReady = () => {
    try { st.info = JSON.parse(App.updateInfo()); } catch (e) { st.info = null; return; }
    setVer('Update ' + st.info.versionName + ' verfügbar');
    maybeShow();
  };
  window.hothNoUpdate = () => {
    if (st.manual) { setVer('aktuell ✓'); setTimeout(() => setVer(''), 4000); }
    st.manual = false; btn.disabled = false;
  };
  window.hothUpdateError = (code) => {
    const txt = { offline: 'Keine Internetverbindung', download: 'Download fehlgeschlagen', install: 'Installer konnte nicht geöffnet werden' }[code] || 'Update-Prüfung fehlgeschlagen';
    if (st.busy) { $('updText').textContent = txt + '. Bitte später erneut versuchen.'; go.disabled = false; go.textContent = 'Erneut versuchen'; st.busy = false; }
    else if (st.manual) setVer(txt);
    st.manual = false; btn.disabled = false;
  };
  window.hothUpdateProgress = (pct) => {
    $('updProg').classList.remove('hidden');
    $('updBar').style.width = Math.max(3, pct) + '%';
    $('updText').textContent = `Lade Version ${st.info ? st.info.versionName : ''} herunter … ${pct}%`;
  };
  window.hothUpdateInstalling = () => {
    st.busy = false; st.downloaded = true;
    $('updBar').style.width = '100%';
    $('updText').textContent = 'Download fertig. Bestätige die Installation im Android-Dialog. Falls Android fragt: „Installation aus dieser Quelle zulassen“ aktivieren.';
    go.disabled = false; go.textContent = 'Installer erneut öffnen';
  };

  btn.addEventListener('click', () => {
    if (!App) return;
    if (st.info) { show(); return; }
    st.manual = true; btn.disabled = true; setVer('suche …');
    App.checkUpdate();
  });
  go.addEventListener('click', () => {
    if (!App || !st.info || st.busy) return;
    if (st.downloaded) { App.installUpdate(); return; }
    st.busy = true; go.disabled = true; go.textContent = 'Lädt …';
    window.hothUpdateProgress(0);
    App.downloadUpdate();
  });
  later.addEventListener('click', () => { modal.classList.add('hidden'); st.dismissed = true; });
})();
