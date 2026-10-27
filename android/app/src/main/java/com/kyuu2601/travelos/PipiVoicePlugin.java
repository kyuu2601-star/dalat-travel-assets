package com.kyuu2601.travelos;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "PipiVoice")
public class PipiVoicePlugin extends Plugin {
    private TextToSpeech tts;
    private PluginCall pending;
    private String pendingId;
    private boolean ready;
    private static final String VOICE_PREFS = "pipi_voice_settings";
    private static final String VOICE_KEY = "vietnamese_voice";

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

    private List<Voice> vietnameseVoices() {
        List<Voice> voices = new ArrayList<>();
        if (!ready || tts == null || tts.getVoices() == null) return voices;
        for (Voice voice : tts.getVoices()) {
            if (voice.getLocale() != null && "vi".equals(voice.getLocale().getLanguage())
                && (voice.getFeatures() == null || !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) {
                voices.add(voice);
            }
        }
        voices.sort(Comparator.comparingInt(Voice::getQuality).reversed()
            .thenComparing(Voice::isNetworkConnectionRequired)
            .thenComparingInt(Voice::getLatency));
        return voices;
    }

    @PluginMethod
    public synchronized void getVoices(PluginCall call) {
        if (!ready || tts == null) { call.reject("VOICE_ENGINE_LOADING"); return; }
        List<Voice> voices = vietnameseVoices();
        JSArray list = new JSArray();
        for (int i = 0; i < voices.size(); i++) {
            Voice voice = voices.get(i);
            JSObject row = new JSObject();
            row.put("id", voice.getName());
            row.put("quality", voice.getQuality());
            row.put("network", voice.isNetworkConnectionRequired());
            row.put("label", "Giọng " + (i + 1) + (voice.isNetworkConnectionRequired() ? " · cần mạng" : " · dùng offline"));
            list.put(row);
        }
        JSObject result = new JSObject();
        result.put("voices", list);
        result.put("selected", getContext().getSharedPreferences(VOICE_PREFS, 0).getString(VOICE_KEY, "auto"));
        result.put("engine", tts.getDefaultEngine());
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void selectVoice(PluginCall call) {
        String id = call.getString("voiceId", "auto");
        if (!"auto".equals(id) && vietnameseVoices().stream().noneMatch(voice -> voice.getName().equals(id))) {
            call.reject("VOICE_NOT_AVAILABLE"); return;
        }
        getContext().getSharedPreferences(VOICE_PREFS, 0).edit().putString(VOICE_KEY, id).apply();
        call.resolve();
    }

    @PluginMethod
    public void openVoiceDownloads(PluginCall call) {
        try {
            Intent intent = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) { call.reject("VOICE_SETTINGS_UNAVAILABLE"); }
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
        String requested = call.getString("voiceId", "");
        String saved = getContext().getSharedPreferences(VOICE_PREFS, 0).getString(VOICE_KEY, "auto");
        String selected = requested.isEmpty() ? saved : requested;
        List<Voice> voices = vietnameseVoices();
        Voice chosen = voices.stream().filter(voice -> voice.getName().equals(selected)).findFirst().orElse(voices.isEmpty() ? null : voices.get(0));
        if (chosen == null || tts.setVoice(chosen) == TextToSpeech.ERROR)
            tts.setLanguage(Locale.forLanguageTag(call.getString("language", "vi-VN")));
        tts.setSpeechRate(0.96f);
        tts.setPitch(1.0f);
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
