(function () {
  const BASE = 'china-navigation/';
  let loadingPromise = null;
  let active = false;

  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g,'d').trim(); }
  function isChina(value) {
    const v = fold(value);
    return ['trung quoc','china','cn','中国','中华人民共和国'].some(a => v === fold(a) || v.includes(fold(a)));
  }
  function isChongqing(value) {
    const v = fold(value);
    return ['trung khanh','chongqing','重庆','重庆市'].some(a => v.includes(fold(a)));
  }
  function isChinaPoint(value) {
    const lat=Number(value?.lat??value?.latitude),lng=Number(value?.lng??value?.lon??value?.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
    const outline=[[73.5,39.5],[79,35.5],[80,30],[88,27.5],[92,28],[97,28],[98,24],[101,21.5],[102,22.5],[106.5,22.8],[108,21.5],[110,20.3],[114,22],[117,23],[120,25],[122,29],[122,40],[125,40],[131,43],[135,48],[132,53],[120,54],[108,49],[95,49],[87,47],[80,45]];
    let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const[xi,yi]=outline[i],[xj,yj]=outline[j];if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;}
    return inside||(lat>=18&&lat<=20.6&&lng>=108.5&&lng<=111.5);
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-china-nav="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = BASE + src; s.dataset.chinaNav = src; s.onload = resolve;
      s.onerror = () => reject(new Error(`Không load được ${src}`));
      document.head.appendChild(s);
    });
  }
  function loadCss() {
    if (document.querySelector('link[data-china-nav-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = BASE + 'china-navigation.css?v=20261008-2'; link.dataset.chinaNavCss = '1';
    document.head.appendChild(link);
  }
  async function ensureLoaded(city = '') {
    if (!loadingPromise) {
      loadingPromise = (async () => {
        loadCss();
        await loadScript('china-config.js');
        await loadScript('gcj02.js');
        await loadScript('amap-provider.js?v=20261009-2');
        await loadScript('amap-route-service.js?v=20261009-3');
        await loadScript('travel-navigation.js?v=20261009-3');
        active = true;
      })();
    }
    await loadingPromise;
    if (isChongqing(city) && !window.ChongqingRoute) await loadScript('chongqing-route.js');
  }

  function currentCountry() { return document.getElementById('selectCountry')?.value || ''; }
  function currentCity() { return document.getElementById('selectCity')?.value || ''; }
  function findPlaceFromRouteButton(button) {
    const card = button.closest('.card-travel');
    const name = card?.querySelector('h3')?.textContent?.trim() || '';
    const rawHref = button.getAttribute('href') || '';
    const absoluteHref = button.href || '';
    const data = Array.isArray(window.fullData) ? window.fullData : [];
    return data.find(item => {
      const map = String(item.map_link || '');
      return (rawHref && map === rawHref) || (absoluteHref && map === absoluteHref) || (name && item.name === name);
    }) || null;
  }
  function poiIdFromLink(link) {
    try {
      const url = new URL(link);
      if (!/(^|\.)amap\.com$/i.test(url.hostname)) return '';
      return url.pathname.match(/\/place\/([A-Za-z0-9]+)/)?.[1] || url.searchParams.get('poiid') || '';
    } catch { return ''; }
  }
  function placeDestination(place) {
    return {
      name: place.name || '', country: place.country || '', city: place.city || '', area: place.area || '',
      lat: place.latitude, lng: place.longitude, coordSystem: place.coordSystem || 'wgs84', mapLink: place.map_link || '',
      poiId: place.amap_poi_id || place.poi_id || poiIdFromLink(place.map_link)
    };
  }
  async function openPlace(place) {
    if (!place) throw new Error('Không xác định được địa điểm từ card.');
    await ensureLoaded(place.city || currentCity());
    await window.TravelNavigation.open({ destination: placeDestination(place) });
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('.route-button:not(.disabled)');
    if (!button) return;
    const place = findPlaceFromRouteButton(button);
    const chinaDestination = isChina(place?.country) || isChinaPoint({lat:place?.latitude,lng:place?.longitude});
    const chinaCurrent = isChina(currentCountry()) || isChinaPoint(window.userPos);
    if (!chinaDestination && !chinaCurrent) return;
    if (!place || (!chinaDestination && !chinaCurrent)) return;
    event.preventDefault(); event.stopPropagation();
    try { await openPlace(place); }
    catch (error) { console.error('[ChinaNavigation]', error); alert(error.message || 'Không mở được China Navigation.'); }
  }, true);

  function maybePreload() {
    if (isChina(currentCountry()) || isChinaPoint(window.userPos)) ensureLoaded(currentCity()).catch(err => console.warn('[ChinaNavigation preload]', err));
  }
  document.addEventListener('change', event => { if (event.target?.id === 'selectCountry' || event.target?.id === 'selectCity') maybePreload(); });
  window.addEventListener('load', () => { maybePreload(); setTimeout(maybePreload, 2500); });
  setInterval(() => { if (!active && (isChina(currentCountry()) || isChinaPoint(window.userPos))) maybePreload(); }, 5000);

  window.ChinaNavigation = { ensureLoaded, openPlace, isChina, isChongqing, isChinaPoint, get active() { return active; } };
})();
