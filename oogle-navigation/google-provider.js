(function () {
  let sdkPromise = null;
  function key() { return String(window.CONFIG?.GOOGLE_MAPS_BROWSER_KEY || '').trim(); }
  function validPoint(p) {
    const lat = Number(p?.lat ?? p?.latitude), lng = Number(p?.lng ?? p?.lon ?? p?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  function ensureSdk() {
    if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
    if (sdkPromise) return sdkPromise;
    if (!key()) return Promise.reject(new Error('Chưa khai báo CONFIG.GOOGLE_MAPS_BROWSER_KEY.'));
    sdkPromise = new Promise((resolve, reject) => {
      const callback = `__travelosGoogleMaps_${Date.now()}`;
      const script = document.createElement('script');
      window[callback] = () => { delete window[callback]; window.google?.maps ? resolve(window.google.maps) : reject(new Error('Google Maps SDK load xong nhưng API không tồn tại.')); };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key())}&v=weekly&loading=async&callback=${callback}`;
      script.async = true; script.defer = true;
      script.onerror = () => { delete window[callback]; sdkPromise = null; reject(new Error('Không tải được Google Maps JavaScript API.')); };
      document.head.appendChild(script);
    });
    return sdkPromise;
  }
  async function createMap(container, center, interactive = true) {
    const maps = await ensureSdk(), c = validPoint(center);
    if (!container || !c) throw new Error('Google Map thiếu container/tọa độ.');
    return new maps.Map(container, {
      center:c, zoom:15, mapTypeControl:false, streetViewControl:false, fullscreenControl:false,
      zoomControl:Boolean(interactive), gestureHandling:interactive ? 'greedy' : 'none', keyboardShortcuts:Boolean(interactive), clickableIcons:Boolean(interactive)
    });
  }
  function clearObjects(map) {
    (map?.__travelObjects || []).forEach(x => { try { x.setMap(null); } catch {} });
    if (map) map.__travelObjects = [];
  }
  function markerIcon(maps, user = false) {
    return user ? { path:maps.SymbolPath.CIRCLE, scale:8, fillColor:'#0ea5e9', fillOpacity:1, strokeColor:'#ffffff', strokeWeight:3 } : undefined;
  }
  function drawNearby(map, payload, onPoiClick) {
    if (!window.google?.maps || !map) return [];
    clearObjects(map);
    const maps = window.google.maps, objects = [], bounds = new maps.LatLngBounds();
    const center = validPoint(payload?.center);
    if (center) {
      const marker = new maps.Marker({ map, position:center, title:'Bạn đang ở đây', icon:markerIcon(maps, true), zIndex:999 });
      objects.push(marker); bounds.extend(center);
    }
    (payload?.pois || []).forEach((poi, index) => {
      const p = validPoint(poi); if (!p) return;
      const marker = new maps.Marker({ map, position:p, title:String(poi.name || ''), label:{ text:String(index + 1), color:'#ffffff', fontWeight:'700' } });
      if (typeof onPoiClick === 'function') marker.addListener('click', () => onPoiClick(poi, index));
      objects.push(marker); bounds.extend(p);
    });
    map.__travelObjects = objects;
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
    return objects;
  }
  function decodePolyline(encoded) {
    const path=[]; let index=0, lat=0, lng=0;
    while(index < String(encoded || '').length){
      let b,shift=0,result=0; do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
      lat += (result&1) ? ~(result>>1) : result>>1; shift=0; result=0;
      do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
      lng += (result&1) ? ~(result>>1) : result>>1; path.push({lat:lat/1e5,lng:lng/1e5});
    }
    return path;
  }
  function drawRoute(map, route, origin, destination) {
    if (!window.google?.maps || !map) return null;
    clearObjects(map);
    const maps=window.google.maps, path=decodePolyline(route?.encodedPolyline), objects=[], bounds=new maps.LatLngBounds();
    if (path.length) {
      const line=new maps.Polyline({ map, path, geodesic:true, strokeOpacity:.95, strokeWeight:6 });
      objects.push(line); path.forEach(p => bounds.extend(p));
    }
    const o=validPoint(origin), d=validPoint(destination);
    if(o){const m=new maps.Marker({map,position:o,title:'Bắt đầu',icon:markerIcon(maps,true)});objects.push(m);bounds.extend(o);}
    if(d){const m=new maps.Marker({map,position:d,title:'Điểm đến'});objects.push(m);bounds.extend(d);}
    map.__travelObjects=objects; if(!bounds.isEmpty()) map.fitBounds(bounds,60);
    return { path, objects };
  }
  function directionsUrl(origin, destination) {
    const o=validPoint(origin), d=validPoint(destination); if(!d) return '';
    const params=new URLSearchParams({api:'1',destination:`${d.lat},${d.lng}`,travelmode:'walking'});
    if(o) params.set('origin',`${o.lat},${o.lng}`);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  window.GoogleMapProvider = { ensureSdk, createMap, drawNearby, drawRoute, decodePolyline, directionsUrl, validPoint, clearObjects };
})();
