package com.kyuu2601.travelos;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.Context;
import android.Manifest;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "PipiVoice", permissions = {@Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})})
public class PipiVoicePlugin extends Plugin {
    private TextToSpeech tts;
    private SpeechRecognizer recognizer;
    private PluginCall pending;
    private String pendingId;
    private boolean ready;
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean audioRouteSelected;
    private String selectedAudioInput = "default";
    private static final String VOICE_PREFS = "pipi_voice_settings";
    private static final String VOICE_KEY = "vietnamese_voice";

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            microphonePermissionResult(call);
        } else {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
        }
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        microphonePermissionResult(call);
    }

    private void microphonePermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("microphone", getPermissionState("microphone").toString());
        call.resolve(result);
    }

    private String inputLabel(AudioDeviceInfo device) {
        switch (device.getType()) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "Loa ngoài · thu bằng mic điện thoại";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "Mic điện thoại · phát qua loa thoại";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLE_HEADSET: return "Tai nghe Bluetooth · thu và phát qua tai nghe";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET: return "Tai nghe có dây · thu và phát qua tai nghe";
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_DEVICE: return "Tai nghe USB · thu và phát qua tai nghe";
            default: return "Thiết bị âm thanh";
        }
    }

    private String routeKind(AudioDeviceInfo device) {
        switch (device.getType()) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "speaker";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "phone";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLE_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_DEVICE: return "headset";
            default: return "";
        }
    }

    @PluginMethod
    public void getAudioInputs(PluginCall call) {
        JSArray devices = new JSArray();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && audioManager != null) {
            boolean hasSpeaker = false, hasPhone = false, hasHeadset = false;
            for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                String kind = routeKind(device);
                if (kind.isEmpty()) continue;
                if (("speaker".equals(kind) && hasSpeaker) || ("phone".equals(kind) && hasPhone) || ("headset".equals(kind) && hasHeadset)) continue;
                if ("speaker".equals(kind)) hasSpeaker = true;
                if ("phone".equals(kind)) hasPhone = true;
                if ("headset".equals(kind)) hasHeadset = true;
                JSObject row = new JSObject();
                row.put("id", String.valueOf(device.getId()));
                row.put("kind", kind);
                String label = inputLabel(device);
                if ("headset".equals(kind)) {
                    CharSequence product = device.getProductName();
                    if (product != null && !product.toString().trim().isEmpty()) label += " · " + product;
                }
                row.put("label", label);
                devices.put(row);
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        result.put("selected", selectedAudioInput);
        call.resolve(result);
    }

    @PluginMethod
    public void selectAudioInput(PluginCall call) {
        String requested = call.getString("id", "default");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || audioManager == null) {
            if ("default".equals(requested)) call.resolve();
            else call.reject("AUDIO_INPUT_SELECTION_UNAVAILABLE");
            return;
        }
        if ("default".equals(requested)) {
            clearAudioRoute();call.resolve();return;
        }
        for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
            if (!String.valueOf(device.getId()).equals(requested)) continue;
            if (!audioRouteSelected) previousAudioMode = audioManager.getMode();
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            if (audioManager.setCommunicationDevice(device)) {
                audioRouteSelected = true;selectedAudioInput = requested;call.resolve();return;
            }
            if (!audioRouteSelected) audioManager.setMode(previousAudioMode);
            call.reject("AUDIO_INPUT_SELECTION_FAILED");return;
        }
        call.reject("AUDIO_INPUT_DISCONNECTED");
    }

    @PluginMethod
    public void clearAudioInput(PluginCall call) {
        clearAudioRoute();call.resolve();
    }

    private void clearAudioRoute() {
        if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && audioRouteSelected) {
            audioManager.clearCommunicationDevice();
            audioManager.setMode(previousAudioMode);
        }
        audioRouteSelected = false;selectedAudioInput = "default";
    }

    @PluginMethod
    public void startRecognition(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("MICROPHONE_PERMISSION_DENIED");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("SPEECH_RECOGNIZER_UNAVAILABLE");
                return;
            }
            try {
                clearRecognizer();
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onEvent(int eventType, Bundle params) {}
                    @Override public void onPartialResults(Bundle results) {
                        sendRecognitionResult(results, false);
                    }
                    @Override public void onResults(Bundle results) {
                        sendRecognitionResult(results, true);
                        clearRecognizer();
                    }
                    @Override public void onError(int error) {
                        JSObject result = new JSObject();
                        result.put("type", "error");
                        result.put("error", error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "not-allowed" : "no-speech");
                        notifyListeners("recognitionResult", result);
                        clearRecognizer();
                    }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "vi-VN"));
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                recognizer.startListening(intent);
                call.resolve();
            } catch (Exception error) {
                clearRecognizer();
                call.reject("SPEECH_RECOGNIZER_START_FAILED");
            }
        });
    }

    private void sendRecognitionResult(Bundle results, boolean isFinal) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        float[] scores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
        JSObject result = new JSObject();
        result.put("type", isFinal ? "final" : "partial");
        result.put("transcript", matches.get(0));
        if (scores != null && scores.length > 0 && scores[0] >= 0) result.put("confidence", scores[0]);
        notifyListeners("recognitionResult", result);
    }

    @PluginMethod
    public void stopRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    @PluginMethod
    public void cancelRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.cancel();
            clearRecognizer();
            call.resolve();
        });
    }

    private void clearRecognizer() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
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
        String language = call.getString("language", "vi-VN");
        if (!language.toLowerCase(Locale.ROOT).startsWith("vi")) {
            int available = tts.setLanguage(Locale.forLanguageTag(language));
            if (available == TextToSpeech.LANG_MISSING_DATA || available == TextToSpeech.LANG_NOT_SUPPORTED) {
                finish("VOICE_LANGUAGE_UNAVAILABLE");
                return;
            }
        } else {
            String requested = call.getString("voiceId", "");
            String saved = getContext().getSharedPreferences(VOICE_PREFS, 0).getString(VOICE_KEY, "auto");
            String selected = requested.isEmpty() ? saved : requested;
            List<Voice> voices = vietnameseVoices();
            Voice chosen = voices.stream().filter(voice -> voice.getName().equals(selected)).findFirst().orElse(voices.isEmpty() ? null : voices.get(0));
            if (chosen == null || tts.setVoice(chosen) == TextToSpeech.ERROR)
                tts.setLanguage(Locale.forLanguageTag(language));
        }
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
        clearRecognizer();
        clearAudioRoute();
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        finish("VOICE_INTERRUPTED");
        super.handleOnDestroy();
    }
}
