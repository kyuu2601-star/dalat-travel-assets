import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Translation rows survive reload for 24 hours and expire afterward', async () => {
  const source=await readFile(new URL('../voice-translation-history.js',import.meta.url),'utf8');
  const saved=new Map();
  const localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  let now=1_800_000_000_000;
  class FakeDate extends Date {static now(){return now;}}
  const open=()=>{const window={};vm.runInNewContext(source,{window,localStorage,Date:FakeDate,JSON,Number,String,Array});return window.PipiTranslationHistory;};
  open().add({sourceLanguage:'vi',targetLanguage:'zh-Hans',sourceText:'Xin chào',translatedText:'你好'});
  assert.equal(open().list().length,1);
  now+=24*60*60*1000+1;
  assert.equal(open().list().length,0);
});
