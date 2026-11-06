export const MAX_USER_MESSAGE_CHARS = 4000;

const INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|bypass|override)\b[\s\S]{0,100}\b(?:previous|prior|system|developer|instructions?|rules?|prompt)\b/i,
  /\b(?:reveal|show|print|repeat|leak|expose)\b[\s\S]{0,80}\b(?:system|developer|hidden|secret)\s*(?:prompt|instructions?|message|rules?)\b/i,
  /\b(?:system|developer)\s*(?:prompt|message)\s*[:=]/i,
  /\b(?:jailbreak|developer\s+mode|dan\s+mode)\b/i,
  /\b(?:bo|bỏ)\s+qua[\s\S]{0,80}\b(?:(?:chi|chỉ)\s*(?:dan|dẫn)|luat|luật|prompt|he\s*thong|hệ\s*thống)\b/i,
  /\b(?:tiet|tiết)\s*lo[\s\S]{0,80}\b(?:prompt|(?:chi|chỉ)\s*(?:dan|dẫn)|he\s*thong|hệ\s*thống)\b/i,
  /\b(?:lam|làm)\s+theo[\s\S]{0,60}\b(?:lenh|lệnh)\s+(?:sau|nay|này)\b/i
];

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const REMOVED_UNTRUSTED_TEXT = '[Nội dung dữ liệu không đáng tin đã được loại bỏ]';
const FOLDED_INJECTION_PATTERNS=[
  /\bbo qua[\s\S]{0,80}\b(?:chi dan|luat|prompt|he thong)\b/,
  /\btiet lo[\s\S]{0,80}\b(?:prompt|chi dan|he thong)\b/,
  /\blam theo[\s\S]{0,60}\blenh (?:sau|nay)\b/
];

const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

export function containsPromptInjection(value) {
  const text=String(value??'').slice(0,12000);
  return INJECTION_PATTERNS.some(pattern=>pattern.test(text))||FOLDED_INJECTION_PATTERNS.some(pattern=>pattern.test(fold(text)));
}
export function inspectTravelRequest(value) {
  const raw=String(value??'').trim();
  if(!raw)return {allowed:false,code:'INPUT_REQUIRED',message:'Bạn nhập nơi muốn tìm hoặc nơi muốn đi nhé.'};
  if(raw.length>MAX_USER_MESSAGE_CHARS)return {
    allowed:false,code:'INPUT_TOO_LONG',
    message:`Câu hỏi hơi dài. Bạn rút gọn còn dưới ${MAX_USER_MESSAGE_CHARS.toLocaleString('vi-VN')} ký tự và nói rõ nơi muốn tìm hoặc muốn đi nhé.`
  };
  if(containsPromptInjection(raw))return {
    allowed:false,code:'GUARDRAIL_BLOCKED',
    message:'Pipi chỉ hỗ trợ tìm địa điểm và chỉ đường du lịch. Bạn nói nơi muốn tìm hoặc muốn đi nhé.'
  };
  return {allowed:true,value:raw.replace(CONTROL_CHARACTERS,'')};
}

export function neutralizeUntrustedText(value, max=10000) {
  const text=String(value??'').replace(CONTROL_CHARACTERS,'').slice(0,max);
  return containsPromptInjection(text)?REMOVED_UNTRUSTED_TEXT:text;
}

export function sanitizeUntrustedData(value, depth=0) {
  if(depth>8)return null;
  if(typeof value==='string')return neutralizeUntrustedText(value);
  if(value==null||typeof value==='number'||typeof value==='boolean')return value;
  if(Array.isArray(value))return value.slice(0,100).map(item=>sanitizeUntrustedData(item,depth+1));
  if(typeof value!=='object')return null;
  const output={};
  for(const [key,item] of Object.entries(value).slice(0,100)){
    if(['__proto__','prototype','constructor'].includes(key))continue;
    output[key]=sanitizeUntrustedData(item,depth+1);
  }
  return output;
}

export function sanitizeConversationHistory(history=[]) {
  return (Array.isArray(history)?history:[]).slice(-8).map(item=>({
    role:item?.role==='ai'||item?.role==='model'?'model':'user',
    content:neutralizeUntrustedText(item?.content,10000)
  })).filter(item=>item.content);
}

const normalizeDigits=value=>String(value??'').replace(/\D/g,'');

export function validateGroundedAnswer(answer, evidence=[]) {
  const text=String(answer??'').trim();
  if(!text)return {ok:false,reasons:['EMPTY_ANSWER']};
  const reasons=[];
  if(containsPromptInjection(text)||/\b(?:system prompt|developer message|hidden instructions?)\b/i.test(text))reasons.push('INTERNAL_INSTRUCTION_LEAK');
  const evidenceText=JSON.stringify(sanitizeUntrustedData(evidence));
  const urls=text.match(/https?:\/\/[^\s)\]}>,]+/gi)||[];
  if(urls.some(url=>!evidenceText.includes(url)))reasons.push('UNGROUNDED_URL');
  const evidenceDigits=normalizeDigits(evidenceText);
  const phones=text.match(/(?:\+(?:84|86)|0)(?:[\s.()-]*\d){8,11}|(?<!\d)1(?:[\s.-]*\d){10}(?!\d)/g)||[];
  if(phones.some(phone=>{const digits=normalizeDigits(phone);return digits.length>=8&&!evidenceDigits.includes(digits);}))reasons.push('UNGROUNDED_PHONE');
  return {ok:reasons.length===0,reasons:[...new Set(reasons)]};
}
