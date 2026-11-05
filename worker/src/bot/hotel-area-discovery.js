// A hotel is an unconfirmed search anchor until the traveler approves a map POI.
export const HOTEL_AREA_PROMPT = `TÌM QUANH KHÁCH SẠN:
1. Tách tên khách sạn, thành phố và mốc gần đó từ câu hỏi; mốc gần đó chỉ dùng để phân biệt các chi nhánh.
2. Backend phải kiểm tra khách sạn trên bản đồ và hỏi lại tên, địa chỉ trước khi tìm nơi ăn chơi. Không dùng GPS của người hỏi thay cho khách sạn.
3. Nếu khách sạn chưa đúng, xin link bản đồ hoặc mô tả mốc gần đó. Không tự đoán chi nhánh khác.
4. Sau khi người hỏi xác nhận, backend mới tìm địa điểm từ tọa độ khách sạn đã chọn. Chỉ giới thiệu những kết quả API thực trả về; buổi tối chỉ gợi ý điểm có thể phù hợp, không khẳng định còn mở khi chưa có giờ hoạt động.`;

export const HOTEL_AREA_CHOICE_SCHEMA={type:'OBJECT',properties:{recommendedIds:{type:'ARRAY',maxItems:3,items:{type:'STRING'}}},required:['recommendedIds']};

const clean=value=>String(value??'').trim().replace(/\s+/g,' ').slice(0,300);
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');

export function parseHotelAreaRequest(message,location={}) {
  const raw=clean(message),key=fold(raw);
  if(!/\b(quanh|gan|xung quanh|ke ben)\b/.test(key)||!/\b(khach san|hotel|ks)\b/.test(key))return null;
  const parenthesized=raw.match(/(?:khách\s*sạn|hotel|ks)\s+của\s+(?:mình|tôi|tui)\s*\(([^)]+)\)/i)?.[1];
  let hotelName=clean(parenthesized||raw.match(/(?:khách\s*sạn|hotel|ks)\s+(?:của\s+(?:mình|tôi|tui)\s+)?(.+)$/i)?.[1]);
  hotelName=hotelName.replace(/\s+(?:nằm|ở|tại|gần|sau|cạnh|đối diện|có|thì|buổi|vào|tìm|kiếm)\s+.*$/i,'').replace(/[(),?!.]+$/,'').trim();
  if(!hotelName||/^(?:của\s+(?:mình|tôi|tui)|mình|tôi|tui)$/i.test(hotelName))return null;
  const city=/trùng\s*khánh|chongqing|重庆/i.test(raw)?'Trùng Khánh'
    :/đà\s*nẵng/i.test(raw)?'Đà Nẵng':/đà\s*lạt/i.test(raw)?'Đà Lạt':clean(location.city);
  const landmark=clean(raw.match(/(?:nằm\s+)?(?:sau|gần|cạnh|đối\s*diện)\s+([^),?.;]+?)(?=\s+(?:có|thì|tìm|kiếm|buổi|vào)\b|[),?.;]|$)/i)?.[1]);
  const interests=[];
  if(/\b(an|quan an|nha hang|am thuc|mon ngon)\b/.test(key))interests.push({query:'quán ăn',category:'restaurant'});
  if(/\b(cafe|ca phe)\b/.test(key))interests.push({query:'cafe',category:'cafe'});
  if(/\b(cua hang tien loi|chtl|tap hoa)\b/.test(key))interests.push({query:'cửa hàng tiện lợi',category:'convenience_store'});
  if(/\b(choi|tham quan|di dau|vui choi|check in|dia diem)\b/.test(key)||!interests.length)interests.push({query:/\b(toi|dem)\b/.test(key)?'điểm vui chơi buổi tối':'điểm tham quan',category:'tourist_attraction'});
  const period=/\b(toi|dem)\b/.test(key)?'buổi tối':/\b(sang)\b/.test(key)?'buổi sáng':/\b(chieu)\b/.test(key)?'buổi chiều':'';
  return {hotelName,city,landmark,interests:interests.slice(0,3),period};
}

export function hotelConfirmation(message) {
  const key=fold(message);
  const selection=key.match(/(?:so|muc|diem)\s*([1-5])\b/);
  if(selection)return {kind:'select',index:Number(selection[1])-1};
  if(/^(?:dung|phai|chuan|ok|oke|u|uh|yes|correct)\b/.test(key))return {kind:'yes',index:0};
  if(/^(?:khong|ko|k |sai|chua dung|khong phai|nham)\b/.test(key))return {kind:'no'};
  return {kind:'description',text:clean(message)};
}
