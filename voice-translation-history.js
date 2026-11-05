// Translation text stays on this device for 24 hours. Audio is never stored.
(() => {
  const KEY='pipi_translation_history_v1';
  const DAY=24*60*60*1000;
  const valid=row=>row && (row.sourceLanguage==='vi'||row.sourceLanguage==='zh-Hans')
    && (row.targetLanguage==='vi'||row.targetLanguage==='zh-Hans')
    && typeof row.sourceText==='string' && typeof row.translatedText==='string'
    && Number.isFinite(row.createdAt) && row.createdAt>Date.now()-DAY && row.createdAt<=Date.now()+60_000;
  function list() {
    try {
      const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
      const rows=(Array.isArray(raw)?raw:[]).filter(valid).slice(-120);
      localStorage.setItem(KEY,JSON.stringify(rows));
      return rows;
    } catch {return [];}
  }
  function add(result) {
    const row={sourceLanguage:result.sourceLanguage,targetLanguage:result.targetLanguage,
      sourceText:String(result.sourceText||'').slice(0,1500),translatedText:String(result.translatedText||'').slice(0,1500),createdAt:Date.now()};
    if(!valid(row) || !row.sourceText || !row.translatedText)return null;
    try {const rows=list();rows.push(row);localStorage.setItem(KEY,JSON.stringify(rows.slice(-120)));}
    catch {}
    return row;
  }
  window.PipiTranslationHistory={list,add};
})();
