package com.kyuu2601.travelos;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "PipiVoice")
public class PipiVoicePlugin extends Plugin {
    private TextToSpeech tts;
    private PluginCall pending;
    private String pendingId;
    private boolean ready;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {}
                @Override public void onDone(String utteranceId) { finishIfCurrent(utteranceId, null); }
                @Override public void onError(String utteranceId) { finishIfCurrent(utteranceId, "VOICE_PLAYBACK_FAILED"); }
            });
        });
    }

    private synchronized void finish(String error) {
        PluginCall call = pending;
        pending = null;
        pendingId = null;
        if (call == null) return;
        if (error == null) call.resolve(new JSObject());
        else call.reject(error);
    }

    private synchronized void finishIfCurrent(String id, String error) {
        if (id != null && id.equals(pendingId)) finish(error);
    }

    @PluginMethod
    public synchronized void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) { call.resolve(); return; }
        if (!ready || tts == null) { call.reject("VOICE_ENGINE_UNAVAILABLE"); return; }
        finish("VOICE_INTERRUPTED");
        pending = call;
        pendingId = UUID.randomUUID().toString();
        tts.stop();
        tts.setLanguage(Locale.forLanguageTag(call.getString("language", "vi-VN")));
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, pendingId);
        if (result == TextToSpeech.ERROR) finish("VOICE_PLAYBACK_FAILED");
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        if (tts != null) tts.stop();
        finish("VOICE_INTERRUPTED");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        finish("VOICE_INTERRUPTED");
        super.handleOnDestroy();
    }
}
