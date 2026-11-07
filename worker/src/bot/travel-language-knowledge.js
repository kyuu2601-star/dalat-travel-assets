// Curated Vietnamese/English travel-language knowledge shared by the
// deterministic planner and the shadow router. Keep execution policy outside
// this file: these entries only improve phrase recognition.

const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phrasePattern=phrases=>new RegExp(`\\b(?:${phrases.map(escapeRegExp).join('|')})\\b`);

export const TRAVEL_LANGUAGE_KNOWLEDGE=Object.freeze({
  route:[
    'chi duong','dan duong','tim duong','duong di','cach di','route','dua toi','dua tui','dua minh','dan toi','dan tui','dan minh',
    'di bo','lai xe','chay xe','di xe','xe may','o to','taxi','di chuyen','traffic','giao thong','ket xe','bao xa','bao lau','mat bao nhieu phut','toi do bang'
  ],
  weather:[
    'thoi tiet','du bao','du bao thoi tiet','troi','co mua','mua khong','mua lon','mua nhe','sap mua','troi mua','co nang','nang khong','troi nang',
    'nang nong','nhiet do','nong khong','lanh khong','gio manh','ao mua','o du','weather','rain','temperature','outdoor'
  ],
  itinerary:[
    'lich trinh','ke hoach','lap lich','xep lich','sap xep lich','sap xep cac diem','plan chuyen di','plan du lich','travel plan','itinerary','tour mot ngay','tour hai ngay'
  ],
  itineraryContext:[
    'lich','lich trinh','du lich','chuyen di','ngay','buoi','sang','trua','chieu','toi','diem','choi','tham quan','an uong','bao tang','ca phe',
    'da lat','da nang','tp hcm','trung khanh','thuong hai','vu long','nam binh','phuong hoang co tran','bac kinh','quang chau','thanh do'
  ],
  safety:[
    'an toan','nguy hiem','canh bao','lua dao','moc tui','cap cuu','can y te','can bac si','co so y te',
    'dau bung','sot','sot cao','bi thuong','bi thuong nang','kho tho','chay mau','chay mau nhieu','dau nguc','ngo doc','ngo doc thuc an','chong mat','di ung',
    'ngat','bat tinh','co giat','tieu chay','tieu chay nhe','dau dau du doi','bong gan','canh sat','cong an','bi trom','mat do'
  ],
  guided:[
    'cu xu','cach ung xu','phep lich su','van hoa','phong tuc','tap quan','nen noi gi','cach giao tiep','kieng ky','xin chao','chao pipi','hello','hello pipi',
    'hi pipi','khoe khong','noi chuyen phiem','noi chuyen','ke chuyen','ke truyen','truyen thuyet','nguoi dia phuong','cam on'
  ],
  actionable:[
    'tim','kiem','gan toi','gan tui','gan minh','gan nhat','quanh','xung quanh','o dau','cho nao','quan nao','tiem nao','chi duong','dan duong','duong di','di bo',
    'lai xe','thoi tiet','du bao','lich trinh','ke hoach','lap lich','xep lich','review','danh gia','mo cua','dong cua','atm','rut tien','nha thuoc','benh vien','phong kham','cap cuu'
  ],
  placeType:[
    'nha thuoc','hieu thuoc','benh vien','phong kham','atm','cua hang tien loi','chtl','sieu thi','tap hoa','nha hang','quan','tiem','quan an','quan com','tiem banh',
    'tiem giat ui','giat ui','cafe','ca phe','khach san','diem tham quan','diem vui choi','gi choi','cong vien','bao tang','trung tam thuong mai','tttm','ga metro',
    'ga tau dien','tram xe buyt','nha ve sinh','toilet','quan bar','pharmacity','long chau','an khang','gs25','circle k','familymart','lawson','kfc','jollibee','lotteria','popeyes','chicken plus'
  ],
  placeDiscovery:[
    'tim','kiem','gan toi','gan tui','gan minh','quanh toi','quanh tui','quanh minh','quanh day','gan day','xung quanh','o dau','cho nao','quan nao','tiem nao','nha hang',
    'quan an','quan com','tiem banh','tiem giat ui','giat ui','cafe','ca phe','khach san','diem choi','diem tham quan','diem vui choi','gi choi','tham quan','check in',
    'cong vien','bao tang','trung tam thuong mai','tttm','nha ve sinh','toilet','mua o dau'
  ],
  venue:[
    'rating','review','danh gia','mo cua','dong cua','dang mo','may gio','dong khong','dong duc','so dien thoai','website','dat ban','tien ich'
  ],
  utility:[
    'atm','rut tien','doi tien','ty gia','sim','esim','wifi','wi fi','internet','cua hang tien loi','chtl','sieu thi','tap hoa','gui do','hanh ly','ve','hotline','lien he'
  ],
  currentOrigin:[
    'quanh day','quanh toi','quanh tui','quanh minh','xung quanh','gan day','gan toi','gan tui','gan minh','vi tri hien tai','tu day','o day','cho toi','cho tui','cho minh','cho dang dung','vi tri nay','dua toi','dua tui','dua minh'
  ],
  knownDestination:[
    'da lat','da nang','tp hcm','ho chi minh','sai gon','vung tau','trung khanh','chongqing','thuong hai','shanghai','vu long','nam binh','phuong hoang co tran',
    'fenghuang','bac kinh','beijing','quang chau','guangzhou','tham quyen','shenzhen','thanh do','chengdu','ho xuan huong','san bay lien khuong','hong nhai dong'
  ]
});

export const TRAVEL_LANGUAGE_PATTERNS=Object.freeze(Object.fromEntries(
  Object.entries(TRAVEL_LANGUAGE_KNOWLEDGE).map(([key,phrases])=>[key,phrasePattern(phrases)])
));
