(function () {
  let fullMap = null;
  let fullPayload = null;
  let fullRoot = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function validPoint(p) {
    const lat = Number(p?.lat ?? p?.latitude);
    const lng = Number(p?.lng ?? p?.lon ?? p?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { ...p, lat, lng } : null;
  }
  function distanceText(value) {
    const m = Number(value);
    if (!Number.isFinite(m) || m < 0) return '';
    return m < 1000 ? `${Math.max(1, Math.round(m))} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  }
  function currentCity(payload) {
    return payload?.pois?.[0]?.city || document.getElementById('selectCity')?.value || '';
  }
  async function ensureMap(payload) {
    if (window.ChinaNavigation?.ensureLoaded) await window.ChinaNavigation.ensureLoaded(currentCity(payload));
    if (!window.AMapProvider?.ensureSdk) throw new Error('AMap module chưa sẵn sàng.');
    return window.AMapProvider.ensureSdk();
  }
  function mapPoint(point, countryHint = '') {
    const p = validPoint(point);
    if (!p) return null;
    const country = p.country || countryHint || '';
    return window.AMapProvider?.toGcj?.({ ...p, country }) || { lat:p.lat, lng:p.lng, country };
  }
  function poiDestination(poi, payload) {
    const p = validPoint(poi);
    if (!p) return null;
    return {
      name:poi.name || '',
      country:poi.country || payload?.center?.country || '',
      city:poi.city || '',
      area:poi.district || '',
      lat:p.lat,
      lng:p.lng,
      coordSystem:poi.coordSystem || 'wgs84',
      poiId:poi.poiId || poi.id || ''
    };
  }

  function makeMarkerContent(index, user = false) {
    return user
      ? '<div class="nearby-pin nearby-pin-user"><span>●</span></div>'
      : `<div class="nearby-pin"><span>${index + 1}</span></div>`;
  }

  async function mountMap(container, payload, interactive) {
    if (!container || !Array.isArray(payload?.pois)) return null;
    const AMap = await ensureMap(payload);
    const country = payload?.center?.country || payload?.pois?.[0]?.country || '';
    const center = mapPoint(payload.center, country) || mapPoint(payload.pois[0], country);
    if (!center) throw new Error('Nearby map thiếu tọa độ.');

    const map = new AMap.Map(container, {
      zoom:15,
      center:[center.lng, center.lat],
      viewMode:'2D',
      resizeEnable:true,
      dragEnable:Boolean(interactive),
      zoomEnable:Boolean(interactive),
      doubleClickZoom:Boolean(interactive),
      keyboardEnable:Boolean(interactive),
      scrollWheel:Boolean(interactive),
      touchZoom:Boolean(interactive)
    });

    const markers = [];
    const centerMarker = new AMap.Marker({
      position:[center.lng, center.lat],
      anchor:'center',
      content:makeMarkerContent(0, true),
      zIndex:200
    });
    map.add(centerMarker); markers.push(centerMarker);

    payload.pois.forEach((poi, index) => {
      const point = mapPoint(poi, country);
      if (!point) return;
      const marker = new AMap.Marker({
        position:[point.lng, point.lat],
        anchor:'bottom-center',
        content:makeMarkerContent(index, false),
        title:String(poi.name || '')
      });
      marker.on?.('click', () => interactive && openRoute(poi, payload));
      map.add(marker); markers.push(marker);
    });

    if (markers.length > 1) map.setFitView(markers, false, interactive ? [70,70,70,70] : [36,36,36,36]);
    return map;
  }

  function poiRow(poi, index, compact = false) {
    const distance = distanceText(poi.distance);
    const address = poi.address || [poi.district, poi.city].filter(Boolean).join(', ');
    const open = poi.openTime ? `<span class="nearby-open">${esc(poi.openTime)}</span>` : '';
    return `<button type="button" class="nearby-poi-row${compact ? ' compact' : ''}" data-nearby-index="${index}">
      <span class="nearby-poi-index">${index + 1}</span>
      <span class="nearby-poi-copy">
        <strong>${esc(poi.name || 'POI')}</strong>
        <small>${esc(address || poi.type || '')}</small>
        <span>${distance ? esc(distance) : ''}${distance && open ? ' · ' : ''}${open}</span>
      </span>
      <span class="nearby-route-arrow">›</span>
    </button>`;
  }

  function render(payload, messageElement) {
    if (!messageElement || !Array.isArray(payload?.pois) || !payload.pois.length) return;
    const card = document.createElement('section');
    card.className = 'nearby-chat-card';
    card.innerHTML = `
      <div class="nearby-chat-head">
        <div><span>AMap Live</span><strong>${esc(payload.query || 'Nearby')}</strong></div>
        <small>${payload.pois.length} điểm</small>
      </div>
      <div class="nearby-mini-map-wrap">
        <div class="nearby-mini-map"></div>
        <button type="button" class="nearby-open-map" aria-label="Mở bản đồ Nearby"><span>Mở bản đồ</span></button>
        <div class="nearby-map-loading">Đang tải AMap...</div>
      </div>
      <div class="nearby-chat-list">${payload.pois.slice(0, 5).map((poi, i) => poiRow(poi, i, true)).join('')}</div>`;
    messageElement.appendChild(card);

    card.querySelector('.nearby-open-map')?.addEventListener('click', () => openFull(payload));
    card.querySelectorAll('[data-nearby-index]').forEach(button => {
      button.addEventListener('click', () => openRoute(payload.pois[Number(button.dataset.nearbyIndex)], payload));
    });

    const mapNode = card.querySelector('.nearby-mini-map');
    const loading = card.querySelector('.nearby-map-loading');
    mountMap(mapNode, payload, false).then(() => loading?.remove()).catch(error => {
      console.warn('[TravelNearby mini map]', error);
      if (loading) loading.textContent = 'Không tải được bản đồ · bấm để thử lại';
    });
  }

  function ensureFullRoot() {
    if (fullRoot?.isConnected) return fullRoot;
    fullRoot = document.createElement('div');
    fullRoot.className = 'nearby-full-overlay';
    fullRoot.setAttribute('aria-hidden', 'true');
    fullRoot.innerHTML = `
      <div class="nearby-full-shell">
        <header class="nearby-full-head">
          <div><span>AMap Nearby</span><h2 id="nearby-full-title">Nearby</h2></div>
          <button type="button" class="nearby-full-close">Close</button>
        </header>
        <div class="nearby-full-map-wrap">
          <div id="nearby-full-map"></div>
          <div id="nearby-full-status">Đang tải AMap...</div>
        </div>
        <div id="nearby-full-list" class="nearby-full-list"></div>
      </div>`;
    document.body.appendChild(fullRoot);
    fullRoot.querySelector('.nearby-full-close')?.addEventListener('click', closeFull);
    fullRoot.addEventListener('click', event => { if (event.target === fullRoot) closeFull(); });
    return fullRoot;
  }

  async function openFull(payload) {
    if (!Array.isArray(payload?.pois) || !payload.pois.length) return;
    const root = ensureFullRoot();
    fullPayload = payload;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('nearby-map-open');
    document.body.classList.add('nearby-map-open');

    root.querySelector('#nearby-full-title').textContent = payload.query || 'Nearby';
    const list = root.querySelector('#nearby-full-list');
    list.innerHTML = payload.pois.map((poi, i) => poiRow(poi, i)).join('');
    list.querySelectorAll('[data-nearby-index]').forEach(button => {
      button.addEventListener('click', () => openRoute(payload.pois[Number(button.dataset.nearbyIndex)], payload));
    });

    const status = root.querySelector('#nearby-full-status');
    status.textContent = 'Đang tải AMap...'; status.classList.remove('hidden');
    try { fullMap?.destroy?.(); } catch {}
    fullMap = null;
    try {
      fullMap = await mountMap(root.querySelector('#nearby-full-map'), payload, true);
      status.classList.add('hidden');
    } catch (error) {
      console.warn('[TravelNearby full map]', error);
      status.textContent = error.message || 'Không tải được AMap.';
    }
  }

  function closeFull() {
    if (!fullRoot) return;
    fullRoot.classList.remove('open');
    fullRoot.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('nearby-map-open');
    document.body.classList.remove('nearby-map-open');
    try { fullMap?.destroy?.(); } catch {}
    fullMap = null; fullPayload = null;
  }

  async function openRoute(poi, payload = fullPayload) {
    const destination = poiDestination(poi, payload);
    if (!destination) return;
    closeFull();
    try {
      if (window.ChinaNavigation?.ensureLoaded) await window.ChinaNavigation.ensureLoaded(destination.city || '');
      if (!window.TravelNavigation?.open) throw new Error('Navigation module chưa sẵn sàng.');
      await window.TravelNavigation.open({ destination });
    } catch (error) {
      console.error('[TravelNearby route]', error);
      alert(error.message || 'Không mở được điều hướng.');
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fullRoot?.classList.contains('open')) closeFull();
  });

  window.TravelNearby = { render, openFull, closeFull, openRoute };
})();
