(function () {
  const MODULES = [
    'CSV_AN_UONG','CSV_TIM_KIEM','DI_CHUYEN','LIEN_HE_QUAN','THOI_TIET',
    'AN_TOAN','LICH_TRINH','CANH_BAO','GIAO_THONG','Y_TE'
  ];

  const PRIORITY = {
    Y_TE:100, THOI_TIET:92, GIAO_THONG:88, AN_TOAN:84, LICH_TRINH:80,
    LIEN_HE_QUAN:76, DI_CHUYEN:72, CANH_BAO:68, CSV_AN_UONG:64, CSV_TIM_KIEM:60
  };

  // Những viết tắt này quá dễ đụng từ thường. Chỉ dùng khi nó là toàn bộ message
  // hoặc có thêm keyword dài hơn cùng module xác nhận.
  const AMBIGUOUS_SHORT = new Set([
    'tt','ct','lt','co','am','bb','av','sa','ci','db','dp','dt','hl','lh','pt','bx','bv','cg','qd','gt','cd','hh','sm','bm','ws','hs','ts'
  ]);

  const EXACT_SHORT_MODULE = {
    ks:'LIEN_HE_QUAN', pk:'Y_TE', kx:'GIAO_THONG', cf:'CSV_AN_UONG',
    ws:'CSV_TIM_KIEM', bx:'DI_CHUYEN', dp:'LIEN_HE_QUAN', hl:'LIEN_HE_QUAN'
  };

  const NEARBY_CUES = [
    'gan day','gan toi','gan tui','gan minh','quanh day','xung quanh','gan nhat','o gan','near me','nearby','closest'
  ];
  const LOCATE_CUES = [
    'tim','o dau','cho nao','di dau','dua di dau','mua o dau','rut tien','do xang','gui xe','dau xe','mo khuya','24h','24 24'
  ];

  const LIVE_POI_RULES = [
    {category:'pharmacy', keyword:'nhà thuốc', modules:['Y_TE'], aliases:['nha thuoc','hieu thuoc','tiem thuoc','pharmacy','drugstore','mua thuoc'], direct:true},
    {category:'hospital', keyword:'bệnh viện', modules:['Y_TE'], aliases:['benh vien','hospital','cap cuu','emergency room'], direct:true},
    {category:'clinic', keyword:'phòng khám', modules:['Y_TE'], aliases:['phong kham','clinic','bac si','doctor','nha khoa'], direct:true},
    {category:'convenience_store', keyword:'cửa hàng tiện lợi', modules:['CSV_TIM_KIEM'], aliases:['cua hang tien loi','convenience store','minimart','mini mart'], direct:true},
    {category:'grocery_store', keyword:'tạp hóa', modules:['CSV_TIM_KIEM'], aliases:['tap hoa','tiem tap hoa','grocery','grocery store','bach hoa'], direct:true},
    {category:'supermarket', keyword:'siêu thị', modules:['CSV_TIM_KIEM'], aliases:['sieu thi','supermarket','hypermarket','winmart','bach hoa xanh'], direct:true},
    {category:'atm', keyword:'ATM', modules:['CSV_TIM_KIEM'], aliases:['atm','rut tien'], direct:true},
    {category:'bank', keyword:'ngân hàng', modules:['CSV_TIM_KIEM'], aliases:['ngan hang','bank','vietcombank','bidv','agribank','vietinbank','techcombank','sacombank'], direct:true},
    {category:'gas_station', keyword:'cây xăng', modules:['CSV_TIM_KIEM'], aliases:['cay xang','tram xang','do xang','mua xang','het xang','gas station','petrol','petrolimex','pvoil'], direct:true},
    {category:'police', keyword:'công an', modules:['CSV_TIM_KIEM'], aliases:['cong an','canh sat','police'], direct:true},
    {category:'fire_station', keyword:'cứu hỏa', modules:['CSV_TIM_KIEM'], aliases:['cuu hoa','fire station'], direct:true},
    {category:'parking', keyword:'bãi đỗ xe', modules:['DI_CHUYEN'], aliases:['bai do xe','bai dau xe','bai xe','gui xe','dau xe','parking'], direct:false},
    {category:'hotel', keyword:'khách sạn', modules:['LIEN_HE_QUAN'], aliases:['khach san','hotel','homestay','resort','villa'], direct:false},
    // Food/cafe vẫn ưu tiên curated PLACES. Chỉ dùng live khi user nói rõ gần đây/xung quanh.
    {category:'restaurant', keyword:'quán ăn', modules:['CSV_AN_UONG'], aliases:['quan an','tiem an','restaurant','cho an'], direct:false, curatedFirst:true},
    {category:'cafe', keyword:'cafe', modules:['CSV_AN_UONG'], aliases:['cafe','ca phe','quan cf','tiem cf','coffee'], direct:false, curatedFirst:true}
  ];

  function fold(value) {
    return String(value ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/đ/g,'d').replace(/Đ/g,'D')
      .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function words(value) { return fold(value).split(/\s+/).filter(Boolean); }
  function hasPhrase(text, phrase) {
    const q = ` ${fold(text)} `, p = fold(phrase);
    return Boolean(p) && q.includes(` ${p} `);
  }
  function hasAny(text, list) { return list.some(item => hasPhrase(text, item)); }

  function keywordWeight(keyword) {
    const p = fold(keyword), list = words(p);
    if (!p) return 0;
    if (list.length >= 4) return 9;
    if (list.length === 3) return 7;
    if (list.length === 2) return 5;
    if (p.length >= 9) return 4;
    if (p.length >= 5) return 3;
    if (p.length >= 3) return 2;
    return 1;
  }

  function matchKeyword(message, keyword, moduleName, hasStrongForModule) {
    const q = fold(message), p = fold(keyword);
    if (!p || !hasPhrase(q, p)) return 0;
    if (EXACT_SHORT_MODULE[p] === moduleName) return q === p ? 3 : 2.5;
    if (AMBIGUOUS_SHORT.has(p)) return hasStrongForModule ? 0.5 : 0;
    if (p.length <= 2) return 0;
    return keywordWeight(p);
  }

  function scoreModules(message) {
    const source = (typeof window.DALAT_KEYWORDS === 'object' && window.DALAT_KEYWORDS) ||
      (typeof DALAT_KEYWORDS === 'object' ? DALAT_KEYWORDS : {});
    const raw = {};

    for (const moduleName of MODULES) {
      const list = Array.isArray(source[moduleName]) ? source[moduleName] : [];
      const strong = [];
      for (const keyword of list) {
        const p = fold(keyword);
        if (!p || AMBIGUOUS_SHORT.has(p) || p.length <= 2) continue;
        if (hasPhrase(message, p)) strong.push({keyword, weight:keywordWeight(p)});
      }
      const hasStrong = strong.some(x => x.weight >= 2);
      const hits = [];
      for (const keyword of list) {
        const weight = matchKeyword(message, keyword, moduleName, hasStrong);
        if (weight > 0) hits.push({keyword:String(keyword), weight});
      }
      hits.sort((a,b) => b.weight - a.weight || b.keyword.length - a.keyword.length);
      const top = hits.slice(0, 5);
      const score = top.reduce((sum, hit, index) => sum + hit.weight * (index === 0 ? 1 : .45), 0);
      if (score >= 2) raw[moduleName] = {score, hits:top};
    }

    // Context boost giảm tình trạng các phrase generic kéo sai module.
    const q = fold(message);
    const boost = (name, amount) => { if (raw[name]) raw[name].score += amount; };
    if (/\b(3n2d|2n1d|4n3d|5n4d|lich trinh|ke hoach|sap xep)\b/.test(q)) boost('LICH_TRINH', 5);
    if (/\b(du bao|thoi tiet|nhiet do|mua|lanh|suong)\b/.test(q)) boost('THOI_TIET', 4);
    if (/\b(benh vien|nha thuoc|phong kham|sot|ngo doc|dau bung|cap cuu)\b/.test(q)) boost('Y_TE', 4);
    if (/\b(ket xe|giao thong|gio cao diem|cam o to|cam tai)\b/.test(q)) boost('GIAO_THONG', 4);
    if (/\b(deo|doc|sat lo|duong tron|tay lai|suong mu|mat thang)\b/.test(q)) boost('AN_TOAN', 4);

    return Object.entries(raw)
      .sort((a,b) => b[1].score - a[1].score || (PRIORITY[b[0]] || 0) - (PRIORITY[a[0]] || 0))
      .map(([moduleName, info]) => ({module:moduleName, score:Number(info.score.toFixed(2)), matches:info.hits.map(x => x.keyword)}));
  }

  function detectLivePoi(message, moduleMatches) {
    const q = fold(message), nearby = hasAny(q, NEARBY_CUES), locating = hasAny(q, LOCATE_CUES);
    const primaryModule = moduleMatches?.[0]?.module || '';
    const matching = LIVE_POI_RULES.filter(rule => rule.aliases.some(alias => hasPhrase(q, alias)));

    for (const rule of matching) {
      // Parking/hotel/food có thể chỉ là constraint phụ trong câu hỏi khác.
      // Chỉ biến chúng thành live target khi module tương ứng đang là intent chính.
      if (rule.category === 'parking' && primaryModule && primaryModule !== 'DI_CHUYEN') continue;
      if (rule.category === 'hotel' && primaryModule && primaryModule !== 'LIEN_HE_QUAN') continue;
      if (['restaurant','cafe'].includes(rule.category) && primaryModule && primaryModule !== 'CSV_AN_UONG') continue;

      const shortUtilityQuestion = words(q).length <= 7;
      const useLive = rule.direct ? (nearby || locating || shortUtilityQuestion) : nearby;
      return {
        category:rule.category,
        keyword:rule.keyword,
        useLive,
        nearby,
        locating,
        strategy:rule.curatedFirst ? 'CURATED_FIRST' : 'DIRECT',
        radius:3000,
        fallbackRadius:5000,
        modules:rule.modules
      };
    }
    return null;
  }

  function inferMode(modules, livePoi) {
    if (livePoi?.useLive && livePoi.strategy === 'DIRECT') return 'LIVE_POI';
    if (modules.includes('LICH_TRINH')) return 'ITINERARY';
    if (modules.includes('CSV_AN_UONG') || modules.includes('CSV_TIM_KIEM')) return livePoi?.nearby ? 'CURATED_NEARBY' : 'CURATED_DISCOVERY';
    if (modules.includes('Y_TE')) return 'HEALTH_TRAVEL';
    if (modules.includes('THOI_TIET')) return 'WEATHER_ADVICE';
    if (modules.includes('GIAO_THONG') || modules.includes('AN_TOAN') || modules.includes('DI_CHUYEN')) return 'TRAVEL_MOBILITY';
    if (modules.includes('LIEN_HE_QUAN')) return 'LODGING_CONTACT';
    if (modules.includes('CANH_BAO')) return 'TRAVEL_CAUTION';
    return 'GENERAL_TRAVEL';
  }

  function route(message) {
    const ranked = scoreModules(message);
    const modules = ranked.slice(0, 4).map(x => x.module);
    const livePoi = detectLivePoi(message, ranked);
    for (const moduleName of livePoi?.modules || []) if (!modules.includes(moduleName)) modules.push(moduleName);
    modules.sort((a,b) => {
      const sa = ranked.find(x => x.module === a)?.score || 0;
      const sb = ranked.find(x => x.module === b)?.score || 0;
      return sb - sa || (PRIORITY[b] || 0) - (PRIORITY[a] || 0);
    });
    const primaryModule = modules[0] || '';
    return {
      version:2,
      mode:inferMode(modules, livePoi),
      primaryModule,
      modules:modules.slice(0, 5),
      scores:ranked.slice(0, 5),
      livePoi,
      nearbyIntent:Boolean(livePoi?.nearby || hasAny(message, NEARBY_CUES))
    };
  }

  function runtimePolicy(plan) {
    const modules = Array.isArray(plan?.modules) ? plan.modules.join(', ') : '';
    return `--- TRAVELOS RUNTIME SOURCE POLICY - ƯU TIÊN CAO NHẤT ---
Intent mode: ${plan?.mode || 'GENERAL_TRAVEL'}.
Modules được router chọn: ${modules || 'TONG_QUAT'}.
Các luật này ghi đè mọi câu cũ trong module prompt nếu mâu thuẫn:
- PLACES/D1 là nguồn curated cho quán ăn, cafe, điểm chơi và dữ liệu TravelOS đã lưu. Không tự bổ sung fact cụ thể của địa điểm nếu PLACES không có.
- Địa điểm live quanh GPS chỉ hợp lệ khi Worker trả từ search_nearby_places. Ngoài Trung Quốc dùng Geoapify, tại Trung Quốc dùng AMap. Không tự quét Google Maps, vệ tinh, web hoặc trí nhớ model để tạo POI.
- Không bịa giờ mở cửa, giá, số điện thoại, rating, review gần đây, tình trạng kẹt xe hiện tại, tình trạng đường hiện tại hay thời tiết hiện tại nếu hệ thống không cung cấp nguồn live tương ứng.
- THOI_TIET: được tư vấn chuẩn bị đồ, mùa/khí hậu và phương án du lịch theo điều kiện user nêu; không giả làm dự báo thời tiết live.
- GIAO_THONG/AN_TOAN/DI_CHUYEN: ưu tiên road_note, warning và dữ liệu curated; kiến thức chung chỉ dùng như hướng dẫn an toàn, không khẳng định hiện trạng live.
- CANH_BAO: được đưa checklist/rủi ro và dùng warning curated; không bịa review/phốt trong 4 tháng gần nhất nếu không có dữ liệu nguồn.
- LIEN_HE_QUAN: chỉ khẳng định tiện ích/hotline/giờ hoạt động khi dữ liệu đã cung cấp; thiếu thì nói cần xác nhận trực tiếp.
- Y_TE: nếu user hỏi triệu chứng thì hỗ trợ an toàn ở mức thông tin chung, không chẩn đoán. Nếu user hỏi nơi khám/mua thuốc gần đây thì dùng live POI.
- LICH_TRINH: phối hợp nhiều module, ưu tiên địa điểm curated trong đúng khu vực và sắp xếp thực tế theo khoảng cách/thời gian đã có.
- Khi câu hỏi có nhiều nhu cầu, kết hợp các module đã chọn trong một câu trả lời thống nhất; không tách rời từng module và không bỏ sót constraint user đã nói.`;
  }

  window.TravelIntentRouter = { route, fold, runtimePolicy, modules:MODULES.slice() };
})();
