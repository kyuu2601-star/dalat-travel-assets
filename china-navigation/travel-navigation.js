(function () {
  let state = { map: null, route: null, rawRoute: null, origin: null, destination: null, currentStep: -1, userMarker: null, gpsTimer: null };

  const $ = sel => document.querySelector(sel);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtM = n => Number(n) < 1000 ? `${Math.round(Number(n) || 0)} m` : `${(Number(n) / 1000).toFixed(1)} km`;
  const fmtT = s => `${Math.max(1, Math.round((Number(s) || 0) / 60))} min`;
  const cfg = () => window.CHINA_NAV_CONFIG || {};

  function ensureModal() {
    if ($('#travel-nav-modal')) return;
    const root = document.createElement('div');
    root.id = 'travel-nav-modal';
    root.className = 'travel-nav-modal';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="tn-shell">
        <div class="tn-map-wrap"><div id="tn-map" class="tn-map"></div><div id="tn-map-status" class="tn-map-status">Đang chuẩn bị AMap...</div></div>
        <aside class="tn-side">
          <div class="tn-head"><div><div class="tn-eyebrow">TRAVELOS · CHINA NAV</div><h2 id="tn-title">Chỉ đường đi bộ</h2><p id="tn-summary">--</p></div><button id="tn-close" class="tn-close" type="button">×</button></div>
          <div id="tn-ai" class="tn-ai"><strong>AI Route Notes</strong><span>Đang chờ route...</span></div>
          <div id="tn-special" class="tn-special"></div>
          <div id="tn-steps" class="tn-steps"></div>
        </aside>
      </div>`;
    document.body.appendChild(root);
    $('#tn-close').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root) close(); });
  }

  function openModal(destination) {
    ensureModal();
    const root = $('#travel-nav-modal');
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('travel-nav-open');
    $('#tn-title').textContent = destination?.name || 'Chỉ đường đi bộ';
    $('#tn-summary').textContent = 'Đang tính đường bằng AMap...';
    $('#tn-steps').innerHTML = '<div class="tn-loading">Đang lấy route thật từ AMap...</div>';
    $('#tn-special').innerHTML = '';
    $('#tn-ai').innerHTML = '<strong>AI Route Notes</strong><span>AI chỉ dịch và diễn giải route AMap, không tự tạo đường.</span>';
  }

  function close() {
    const root = $('#travel-nav-modal');
    if (root) { root.classList.remove('open'); root.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('travel-nav-open');
    if (state.gpsTimer) clearInterval(state.gpsTimer);
    state.gpsTimer = null;
    try { state.map?.destroy?.(); } catch {}
    state = { map: null, route: null, rawRoute: null, origin: null, destination: null, currentStep: -1, userMarker: null, gpsTimer: null };
  }

  function originFromApp() {
    const p = window.userPos;
    if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return null;
    return { lat: Number(p.lat), lng: Number(p.lon), coordSystem: 'wgs84' };
  }

  function isChongqing(destination) {
    const text = `${destination?.city || ''} ${destination?.area || ''} ${destination?.name || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return (cfg().chongqingAliases || []).some(x => text.includes(String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  }

  function stepIcon(step) {
    const feature = step.feature || window.ChongqingRoute?.classify?.(step);
    if (feature?.icon) return feature.icon;
    const t = `${step.action} ${step.instruction}`.toLowerCase();
    if (t.includes('左') || t.includes('left') || t.includes('trái')) return '↰';
    if (t.includes('右') || t.includes('right') || t.includes('phải')) return '↱';
    return '↑';
  }

  function hasCjk(text) { return /[\u3400-\u9fff]/.test(String(text || '')); }
  function directionVi(value) {
    const raw = String(value || '');
    const map = [
      ['东北','Đông Bắc'],['东南','Đông Nam'],['西北','Tây Bắc'],['西南','Tây Nam'],
      ['东','Đông'],['西','Tây'],['南','Nam'],['北','Bắc']
    ];
    for (const [cn, vi] of map) if (raw.includes(cn)) return vi;
    const low = raw.toLowerCase();
    if (low.includes('northeast')) return 'Đông Bắc';
    if (low.includes('southeast')) return 'Đông Nam';
    if (low.includes('northwest')) return 'Tây Bắc';
    if (low.includes('southwest')) return 'Tây Nam';
    if (low.includes('east')) return 'Đông';
    if (low.includes('west')) return 'Tây';
    if (low.includes('south')) return 'Nam';
    if (low.includes('north')) return 'Bắc';
    return '';
  }

  function actionVi(step) {
    const text = `${step.action || ''} ${step.assistantAction || ''} ${step.instruction || ''}`;
    if (/左转|向左|left/i.test(text)) return 'sau đó rẽ trái';
    if (/右转|向右|right/i.test(text)) return 'sau đó rẽ phải';
    if (/掉头|u[- ]?turn/i.test(text)) return 'sau đó quay đầu';
    if (/楼梯|台阶|stairs?/i.test(text)) return 'đi theo cầu thang';
    if (/电梯|elevator|lift/i.test(text)) return 'đi thang máy';
    if (/扶梯|escalator/i.test(text)) return 'đi thang cuốn';
    if (/天桥|skybridge/i.test(text)) return 'đi qua cầu vượt / skybridge';
    if (/地下通道|underpass/i.test(text)) return 'đi qua hầm chui';
    if (/到达|arrive/i.test(text)) return 'đến điểm tiếp theo';
    return '';
  }

  function fallbackInstruction(step) {
    if (step.viInstruction) return step.viInstruction;
    const dir = directionVi(step.orientation) || directionVi(step.instruction);
    const road = !hasCjk(step.road) ? String(step.road || '').trim() : '';
    const distance = Math.max(0, Math.round(Number(step.distance) || 0));
    const action = actionVi(step);
    const feature = step.feature || window.ChongqingRoute?.classify?.(step);

    let base = road ? `Đi dọc ${road}` : 'Đi bộ';
    if (dir) base += ` về hướng ${dir}`;
    if (distance) base += ` ${distance} m`;
    if (feature?.type && feature.type !== 'normal' && feature.label) base += ` qua ${feature.label.toLowerCase()}`;
    if (action) base += `, ${action}`;
    return `${base}.`;
  }

  function renderSteps(route) {
    const container = $('#tn-steps');
    container.innerHTML = (route.steps || []).map((step, i) => {
      const feature = step.feature || window.ChongqingRoute?.classify?.(step) || {};
      const instruction = fallbackInstruction(step);
      return `<article class="tn-step ${state.currentStep === i ? 'active' : ''}" data-step="${i}"><div class="tn-step-icon">${esc(stepIcon(step))}</div><div class="tn-step-body"><div class="tn-step-main">${esc(instruction)}</div><div class="tn-step-meta">${esc(fmtM(step.distance))}${feature.type && feature.type !== 'normal' ? ` · ${esc(feature.label)}` : ''}</div></div></article>`;
    }).join('') || '<div class="tn-loading">AMap không trả step chi tiết.</div>';
  }

  function renderRouteMeta(route, chongqing) {
    $('#tn-summary').textContent = `${fmtT(route.duration)} · ${fmtM(route.distance)}`;
    if (chongqing && window.ChongqingRoute) {
      const text = window.ChongqingRoute.summary(route);
      $('#tn-special').innerHTML = `<strong>Chongqing Terrain</strong><span>${esc(text)}</span>`;
    } else $('#tn-special').innerHTML = '';
  }

  function haversine(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dp = (b.lat - a.lat) * Math.PI / 180, dl = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dp/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function nearestStep(userGcj) {
    let best = { index: -1, distance: Infinity };
    (state.route?.steps || []).forEach((step, i) => (step.path || []).forEach(p => {
      const d = haversine(userGcj, p);
      if (d < best.distance) best = { index: i, distance: d };
    }));
    return best;
  }

  function setCurrentStep(index) {
    if (index < 0 || index === state.currentStep) return;
    state.currentStep = index;
    document.querySelectorAll('.tn-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === index));
    const active = document.querySelector(`.tn-step[data-step="${index}"]`);
    active?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  function updateUserMarker() {
    if (!state.map || !window.AMap || !window.userPos) return;
    const p = window.AMapProvider.toGcj({ lat: window.userPos.lat, lng: window.userPos.lon, coordSystem: 'wgs84' });
    if (!p) return;
    if (!state.userMarker) {
      state.userMarker = new AMap.Marker({ position: [p.lng, p.lat], anchor: 'center', content: '<div class="tn-user-dot"><i></i></div>', zIndex: 200 });
      state.map.add(state.userMarker);
    } else state.userMarker.setPosition([p.lng, p.lat]);
    const near = nearestStep(p);
    if (near.index >= 0 && near.distance <= Number(cfg().route?.stepSnapMeters || 35)) setCurrentStep(near.index);
  }

  function parseJsonObject(text) {
    let raw = String(text || '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI không trả JSON hợp lệ.');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function localizeRouteWithAI(route, destination) {
    const node = $('#tn-ai');
    const ai = cfg().ai || {};
    if (!ai.enabled || !ai.endpoint) {
      node.innerHTML = '<strong>AI Route Notes</strong><span>AI đang tắt. Sidebar vẫn dùng bản dịch cơ bản tại máy.</span>';
      return;
    }

    const compactSteps = (route.steps || []).map((s, i) => ({
      i: i + 1,
      instruction: s.instruction,
      road: s.road,
      orientation: s.orientation,
      distance: s.distance,
      action: s.action,
      assistantAction: s.assistantAction,
      walkType: s.walkType,
      feature: s.feature?.label || ''
    }));

    node.innerHTML = '<strong>AI Route Notes</strong><span>Đang dịch từng bước sang tiếng Việt...</span>';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(ai.timeoutMs || 12000));

    try {
      const response = await fetch(ai.endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: `Bạn là TravelOS Route Localizer. Dữ liệu AMap là nguồn sự thật tuyệt đối. Hãy dịch từng instruction sang tiếng Việt tự nhiên, dễ đi bộ theo. TUYỆT ĐỐI không thêm đường, không bỏ bước, không đổi thứ tự, không đổi khoảng cách, không tạo shortcut. Giữ nguyên tên riêng nếu không chắc cách dịch. Nếu step có feature như cầu thang, thang máy, thang cuốn, skybridge, hầm hoặc lối xuyên tòa nhà thì phải nói rõ. Chỉ trả về JSON hợp lệ, không markdown, đúng schema: {"steps":[{"i":1,"vi":"..."}],"note":"..."}. Mảng steps phải có đúng số phần tử và đúng i như input. note chỉ được mô tả ngắn gọn các điểm đáng chú ý đã có trong route, không bịa thêm.`,
          userMessage: `Điểm đến: ${destination?.name || ''}\nAMap route JSON: ${JSON.stringify(compactSteps)}`,
          chatHistory: [],
          matchedModules: [],
          userLocation: {
            country: document.getElementById('selectCountry')?.value || '',
            city: document.getElementById('selectCity')?.value || '',
            area: document.getElementById('selectArea')?.value || '',
            latitude: window.userPos?.lat ?? null,
            longitude: window.userPos?.lon ?? null,
            source: 'gps'
          }
        })
      });

      const data = await response.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text || '';
      const parsed = parseJsonObject(text);
      const translated = Array.isArray(parsed.steps) ? parsed.steps : [];
      const byIndex = new Map(translated.map(item => [Number(item.i), String(item.vi || '').trim()]));

      (route.steps || []).forEach((step, i) => {
        const vi = byIndex.get(i + 1);
        if (vi) step.viInstruction = vi;
      });

      renderSteps(route);
      const note = String(parsed.note || '').trim();
      node.innerHTML = `<strong>AI Route Notes</strong><span>${esc(note || 'Đã dịch toàn bộ chỉ dẫn AMap sang tiếng Việt.').replace(/\n/g,'<br>')}</span>`;
    } catch (error) {
      console.warn('[TravelNavigation localization]', error);
      node.innerHTML = '<strong>AI Route Notes</strong><span>AI dịch step không phản hồi. Sidebar đang dùng bản dịch cơ bản tại máy, route AMap vẫn giữ nguyên.</span>';
    } finally {
      clearTimeout(timer);
    }
  }

  async function open(options = {}) {
    const destination = options.destination || options;
    openModal(destination);
    try {
      const origin = options.origin || originFromApp();
      if (!origin) throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');
      const resolvedDestination = await window.AMapProvider.resolveDestination({ ...destination, coordSystem: destination.coordSystem || cfg().route?.destinationCoordinateSystem || 'wgs84' });
      const planned = await window.AMapProvider.walkingRoute(origin, resolvedDestination);
      const chongqing = isChongqing(destination);
      let route = planned.routes[0];
      if (chongqing && window.ChongqingRoute) route = window.ChongqingRoute.chooseEasier(planned.routes) || window.ChongqingRoute.analyze(route);
      else if (window.ChongqingRoute) route = window.ChongqingRoute.analyze(route);

      state.origin = planned.origin;
      state.destination = planned.destination;
      state.rawRoute = planned;
      state.route = route;
      state.map = await window.AMapProvider.createMap('tn-map', planned.origin);
      window.AMapProvider.drawRoute(state.map, route, planned.origin, planned.destination);
      $('#tn-map-status').classList.add('hidden');
      renderRouteMeta(route, chongqing);
      renderSteps(route);
      updateUserMarker();
      state.gpsTimer = setInterval(updateUserMarker, Number(cfg().route?.gpsPollMs || 1500));
      localizeRouteWithAI(route, destination);
    } catch (error) {
      $('#tn-map-status').textContent = error.message || 'Navigation error';
      $('#tn-map-status').classList.remove('hidden');
      $('#tn-summary').textContent = 'Không thể tạo route';
      $('#tn-steps').innerHTML = `<div class="tn-error">${esc(error.message || 'Navigation error')}</div>`;
    }
  }

  window.TravelNavigation = { open, close };
})();
