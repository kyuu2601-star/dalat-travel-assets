package com.kyuu2601.travelos;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private Insets systemBarInsets = Insets.NONE;
    private boolean keyboardVisible = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PipiVoicePlugin.class);
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        EdgeToEdge.enable(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.rgb(2, 6, 23)));
        getWindow().getDecorView().setBackgroundColor(Color.rgb(2, 6, 23));
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setPadding(0, 0, 0, 0);
            content.setBackgroundColor(Color.rgb(2, 6, 23));
        }
        getBridge().getWebView().setBackgroundColor(Color.rgb(2, 6, 23));
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                injectSafeAreaInsets();
            }
        });

        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            systemBarInsets = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            injectSafeAreaInsets();
            return insets;
        });
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }

    private void injectSafeAreaInsets() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        float density = getResources().getDisplayMetrics().density;
        int top = Math.round(systemBarInsets.top / density);
        int right = Math.round(systemBarInsets.right / density);
        int bottom = keyboardVisible ? 0 : Math.round(systemBarInsets.bottom / density);
        int left = Math.round(systemBarInsets.left / density);
        String script = String.format(
            Locale.US,
            "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');",
            top,
            right,
            bottom,
            left
        );
        WebView webView = getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
