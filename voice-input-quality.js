// Web Speech cannot measure ambient noise or separate overlapping speakers.
// Reject only clear recognition failures; let the backend clarify uncertain meaning.
window.PipiVoiceQuality = function assessVoiceInput(text, confidence, hadRecognitionError = false) {
  const spoken = String(text ?? '').normalize('NFC').trim();
  const words = spoken.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const letters = (spoken.match(/\p{L}/gu) || []).length;
  if (hadRecognitionError || !spoken || letters < 2 || words.length === 0) return { clear: false, reason: 'unheard' };
  if (/^(.)\1{4,}$/u.test(spoken.replace(/\s/g, ''))) return { clear: false, reason: 'noise' };
  if (words.length >= 3 && new Set(words).size === 1) return { clear: false, reason: 'repeated' };
  if (words.every(word => /^(a|à|á|ạ|ờ|ừ|ừm|ưm|um|hmm|hm|ơ|ồ|ô)$/.test(word))) return { clear: false, reason: 'filler' };
  const score = Number(confidence);
  if (Number.isFinite(score) && score > 0 && score < 0.35 && words.length <= 4) return { clear: false, reason: 'low-confidence' };
  return { clear: true, text: spoken };
};
