# Pipi local Vietnamese voice

Supertonic 3, fixed Sarah voice (F1), Vietnamese, nine denoising steps and 1.20x speed. Inference runs in
a dedicated browser worker using ONNX Runtime Web 1.23.2. No text is sent to a
TTS API. The model downloads once (398,651,996 bytes), is verified by SHA-256,
and is stored in the browser/WebView Cache Storage. Clearing app/site storage
requires a fresh download. The model stays loaded while the app is open.

Model revision: `aafc6e32416a594460b32413efc49d7fe4ce6d46` from
<https://huggingface.co/supertone-oss-archive/supertonic-3>.
The model's OpenRAIL-M terms are included in MODEL-LICENSE.txt.

The helper in vendor/supertonic.mjs is adapted from the official MIT example:
<https://github.com/supertone-oss-archive/supertonic/blob/main/web/helper.js>.
Changes: relative ONNX import and explicit tensor cleanup after each inference.
ONNX Runtime is MIT licensed; its notices are included in vendor/.

Model files are served from the existing Pipi R2 bucket under
`voice-models/supertonic3-f3-vi-r1/`. The existing model directory and browser
cache are shared with the previous F3 voice, so returning users only download the
F1 style file. The style and settings are specified in model-manifest.json. Weights are
not committed to Git. The checked-out evaluation copy lives under ignored
`.toolchains/tts-lab/supertonic-main/assets/`.

Measured on the development Mac: native ONNX 0.63–0.65 s, browser WASM with one
thread about 3.0 s for a 6.6-second Vietnamese sentence. These are development
measurements, not Samsung device benchmarks. API search and AI response
generation still require the network.
