(function () {
  const WALK_TYPES = {
    '0': ['Đường thường', '🚶'], '1': ['Vạch qua đường', '🚸'], '3': ['Hầm chui', '⬇️'], '4': ['Cầu vượt bộ hành', '🌉'],
    '5': ['Lối đi metro', '🚇'], '6': ['Công viên', '🌳'], '7': ['Quảng trường', '🏙️'], '8': ['Thang cuốn', '↗️'],
    '9': ['Thang máy', '🛗'], '10': ['Cáp treo', '🚠'], '11': ['Skybridge / lối đi trên cao', '🌉'], '12': ['Lối xuyên tòa nhà', '🏢'],
    '13': ['Lối đi bộ', '🚶'], '14': ['Tuyến thuyền', '⛴️'], '15': ['Xe tham quan', '🚎'], '16': ['Đường trượt', '↘️'],
    '18': ['Đường mở rộng', '↔️'], '19': ['Đường nối phụ', '🔗'], '20': ['Cầu thang', '🪜'], '21': ['Dốc', '⛰️'],
    '22': ['Cầu', '🌉'], '23': ['Đường hầm', '🚇'], '30': ['Phà', '⛴️']
  };

  const KEYWORDS = [
    { keys: ['楼梯','阶梯','台阶','stair','stairs','cầu thang'], type: 'stairs', label: 'Cầu thang', icon: '🪜', penalty: 5 },
    { keys: ['扶梯','escalator','thang cuốn'], type: 'escalator', label: 'Thang cuốn', icon: '↗️', penalty: 1 },
    { keys: ['电梯','直梯','elevator','lift','thang máy'], type: 'elevator', label: 'Thang máy', icon: '🛗', penalty: 0 },
    { keys: ['天桥','skybridge','空中通道','cầu vượt','lối đi trên cao'], type: 'skybridge', label: 'Skybridge', icon: '🌉', penalty: 1 },
    { keys: ['地下通道','underpass','hầm chui'], type: 'underpass', label: 'Hầm chui', icon: '⬇️', penalty: 2 },
    { keys: ['建筑物穿越通道','building passage','xuyên tòa nhà'], type: 'building', label: 'Lối xuyên tòa nhà', icon: '🏢', penalty: 1 },
    { keys: ['斜坡','ramp','dốc'], type: 'ramp', label: 'Dốc', icon: '⛰️', penalty: 3 }
  ];

  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function fromWalkType(code) {
    const hit = WALK_TYPES[String(code || '')];
    if (!hit) return null;
    const typeMap = { '8':'escalator','9':'elevator','11':'skybridge','12':'building','20':'stairs','21':'ramp','3':'underpass','4':'skybridge' };
    return { type: typeMap[String(code)] || 'normal', label: hit[0], icon: hit[1], walkType: String(code) };
  }
  function classify(step) {
    const byCode = fromWalkType(step?.walkType);
    if (byCode && byCode.type !== 'normal') return byCode;
    const text = fold([step?.instruction, step?.action, step?.assistantAction, step?.road].join(' '));
    for (const item of KEYWORDS) if (item.keys.some(k => text.includes(fold(k)))) return { ...item, walkType: String(step?.walkType || '') };
    return byCode || { type: 'normal', label: 'Đi bộ', icon: '🚶', walkType: String(step?.walkType || '') };
  }
  function decorateStep(step) { return { ...step, feature: classify(step) }; }
  function analyze(route) {
    const steps = (route?.steps || []).map(decorateStep);
    const counts = { stairs:0, elevator:0, escalator:0, skybridge:0, underpass:0, building:0, ramp:0 };
    let difficulty = 0;
    steps.forEach(step => {
      const type = step.feature?.type;
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type]++;
      const keyword = KEYWORDS.find(x => x.type === type);
      difficulty += keyword?.penalty || 0;
    });
    difficulty += Math.max(0, Number(route?.distance || 0) / 1000 - 1);
    return { ...route, steps, counts, difficulty: Number(difficulty.toFixed(1)) };
  }
  function chooseEasier(routes) { return [...(routes || [])].map(analyze).sort((a, b) => a.difficulty - b.difficulty || a.distance - b.distance)[0] || null; }
  function summary(route) {
    const r = route?.steps?.[0]?.feature ? route : analyze(route);
    const c = r.counts || {};
    const parts = [];
    if (c.stairs) parts.push(`${c.stairs} đoạn cầu thang`);
    if (c.elevator) parts.push(`${c.elevator} thang máy`);
    if (c.escalator) parts.push(`${c.escalator} thang cuốn`);
    if (c.skybridge) parts.push(`${c.skybridge} skybridge/cầu vượt`);
    if (c.building) parts.push(`${c.building} lối xuyên tòa nhà`);
    if (c.ramp) parts.push(`${c.ramp} đoạn dốc`);
    return parts.join(' · ') || 'Không phát hiện đoạn địa hình đặc biệt trong dữ liệu route.';
  }

  window.ChongqingRoute = { WALK_TYPES, classify, decorateStep, analyze, chooseEasier, summary };
})();
