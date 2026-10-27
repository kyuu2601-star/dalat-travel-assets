import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../voice-input-quality.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const assess = context.window.PipiVoiceQuality;

test('Voice input rejects empty, repetitive, filler and low-confidence speech', () => {
  for (const input of ['', 'a', 'ờ ừm', 'hello hello hello', 'abcd']) {
    const score = input === 'abcd' ? 0.2 : undefined;
    assert.equal(assess(input, score).clear, false, input);
  }
  assert.equal(assess('cửa hàng tiện lợi quanh đây', 0.8, 'no-speech').clear, false);
});

test('Voice input accepts normal travel questions and missing confidence', () => {
  assert.equal(assess('Quanh đây có cửa hàng tiện lợi không?', 0.86).clear, true);
  assert.equal(assess('Thời tiết Đà Lạt', 0).clear, true);
  assert.equal(assess('Raffles City', undefined).clear, true);
});
