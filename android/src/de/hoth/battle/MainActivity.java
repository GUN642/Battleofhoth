package de.hoth.battle;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Vollbild-WebView, die das Spiel aus den App-Assets lädt. */
public class MainActivity extends Activity {
    private static final int IMMERSIVE_FLAGS = 0x00000100 /* LAYOUT_STABLE */
            | 0x00000200 /* LAYOUT_HIDE_NAVIGATION */
            | 0x00000400 /* LAYOUT_FULLSCREEN */
            | 0x00000002 /* HIDE_NAVIGATION */
            | 0x00000004 /* FULLSCREEN */
            | 0x00001000 /* IMMERSIVE_STICKY */;

    private WebView web;

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
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFFCFDBE6);
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
        hideSystemUi();
    }

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
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
