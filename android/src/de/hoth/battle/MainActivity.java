package de.hoth.battle;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Vollbild-WebView, die das Spiel aus den App-Assets lädt, plus automatische Update-Prüfung. */
public class MainActivity extends Activity {
    /** Versionsinfo im GitHub-Repository (HEAD = Standard-Branch). */
    static final String UPDATE_URL = "https://raw.githubusercontent.com/GUN642/Battleofhoth/HEAD/dist/version.json";
    /** Nur APKs aus diesem Repository werden heruntergeladen. */
    static final String APK_PREFIX = "https://raw.githubusercontent.com/GUN642/Battleofhoth/";

    private static final int IMMERSIVE_FLAGS = 0x00000100 /* LAYOUT_STABLE */
            | 0x00000200 /* LAYOUT_HIDE_NAVIGATION */
            | 0x00000400 /* LAYOUT_FULLSCREEN */
            | 0x00000002 /* HIDE_NAVIGATION */
            | 0x00000004 /* FULLSCREEN */
            | 0x00001000 /* IMMERSIVE_STICKY */;

    private WebView web;
    private final Handler handler = new Handler();
    private boolean pageReady;
    private boolean pendingNotify;
    private volatile String updateJson;
    private volatile String updateApk;
    private long downloadId = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (pendingNotify) { pendingNotify = false; js("window.hothUpdateReady&&hothUpdateReady()"); }
            }
        });
        web.setBackgroundColor(0xFF9FB4CC);
        web.addJavascriptInterface(new Bridge(), "HothApp");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
        hideSystemUi();
        checkForUpdate(false);
    }

    // ------------------------------------------------------------------ Update-Prüfung
    private int versionCode() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
    }

    private String versionName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    private void checkForUpdate(final boolean manual) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    JSONObject j = new JSONObject(fetch(UPDATE_URL + "?t=" + System.currentTimeMillis()));
                    int code = j.getInt("versionCode");
                    String apk = j.getString("apk");
                    if (code > versionCode() && apk.startsWith(APK_PREFIX)) {
                        // Nur bekannte Felder weiterreichen
                        JSONObject out = new JSONObject();
                        out.put("versionCode", code);
                        out.put("versionName", j.optString("versionName", String.valueOf(code)));
                        JSONArray notes = j.optJSONArray("notes");
                        JSONArray clean = new JSONArray();
                        if (notes != null) for (int i = 0; i < notes.length() && i < 12; i++) clean.put(notes.optString(i));
                        out.put("notes", clean);
                        updateJson = out.toString();
                        updateApk = apk;
                        notifyPage();
                    } else if (manual) {
                        js("window.hothNoUpdate&&hothNoUpdate()");
                    }
                } catch (Exception e) {
                    if (manual) js("window.hothUpdateError&&hothUpdateError('offline')");
                }
            }
        }).start();
    }

    private static String fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setUseCaches(false);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0 && bo.size() < 65536) bo.write(buf, 0, n);
            return bo.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    private void notifyPage() {
        runOnUiThread(new Runnable() {
            public void run() {
                if (pageReady) js("window.hothUpdateReady&&hothUpdateReady()");
                else pendingNotify = true;
            }
        });
    }

    private void js(final String code) {
        runOnUiThread(new Runnable() {
            public void run() { if (web != null) web.loadUrl("javascript:" + code); }
        });
    }

    private File apkFile() {
        return new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "BattleOfHoth-update.apk");
    }

    private void startDownload() {
        runOnUiThread(new Runnable() {
            public void run() {
                try {
                    File f = apkFile();
                    if (f.exists()) f.delete();
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    DownloadManager.Request r = new DownloadManager.Request(Uri.parse(updateApk));
                    r.setTitle("Battle of Hoth Update");
                    r.setMimeType("application/vnd.android.package-archive");
                    r.setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, f.getName());
                    r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
                    downloadId = dm.enqueue(r);
                    handler.postDelayed(poll, 400);
                } catch (Exception e) {
                    js("window.hothUpdateError&&hothUpdateError('download')");
                }
            }
        });
    }

    /** Fortschritt des Downloads abfragen (ohne BroadcastReceiver). */
    private final Runnable poll = new Runnable() {
        public void run() {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            Cursor c = dm.query(new DownloadManager.Query().setFilterById(downloadId));
            if (c == null) return;
            try {
                if (!c.moveToFirst()) { js("window.hothUpdateError&&hothUpdateError('download')"); return; }
                int status = c.getInt(c.getColumnIndex(DownloadManager.COLUMN_STATUS));
                long done = c.getLong(c.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = c.getLong(c.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    js("window.hothUpdateProgress&&hothUpdateProgress(100)");
                    install();
                } else if (status == DownloadManager.STATUS_FAILED) {
                    js("window.hothUpdateError&&hothUpdateError('download')");
                } else {
                    int pct = total > 0 ? (int) (done * 100 / total) : 0;
                    js("window.hothUpdateProgress&&hothUpdateProgress(" + pct + ")");
                    handler.postDelayed(this, 400);
                }
            } finally {
                c.close();
            }
        }
    };

    private void install() {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            Uri uri = dm.getUriForDownloadedFile(downloadId);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            js("window.hothUpdateInstalling&&hothUpdateInstalling()");
        } catch (Exception e) {
            // Rückfall: APK im Browser öffnen
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(updateApk)));
                js("window.hothUpdateInstalling&&hothUpdateInstalling()");
            } catch (Exception e2) {
                js("window.hothUpdateError&&hothUpdateError('install')");
            }
        }
    }

    /** Schnittstelle für das Spiel (window.HothApp). */
    class Bridge {
        @JavascriptInterface public String versionName() { return MainActivity.this.versionName(); }
        @JavascriptInterface public int versionCode() { return MainActivity.this.versionCode(); }
        @JavascriptInterface public String updateInfo() { return updateJson; }
        @JavascriptInterface public void checkUpdate() { checkForUpdate(true); }
        @JavascriptInterface public void downloadUpdate() { if (updateApk != null) startDownload(); }
        @JavascriptInterface public void installUpdate() {
            runOnUiThread(new Runnable() { public void run() { if (downloadId >= 0) install(); } });
        }
    }

    // ------------------------------------------------------------------ Vollbild & Lebenszyklus
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE_FLAGS);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.loadUrl("javascript:window.hothPause&&hothPause()");
            web.onPause();
            web.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
        }
        hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        // Im Hauptmenü beendet "Zurück" die App, sonst pausiert es das Spiel.
        if (web == null || "Hoth-Menu".equals(web.getTitle())) {
            super.onBackPressed();
        } else {
            web.loadUrl("javascript:window.hothBack&&hothBack()");
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(poll);
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
