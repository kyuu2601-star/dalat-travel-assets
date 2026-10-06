(function () {
  const objectStore = new WeakMap();
  let sdkPromise = null;

  function key() { return String(window.CONFIG?.GEOAPIFY_BROWSER_KEY || '').trim(); }
  function validPoint(p) {
    const lat=Number(p?.lat??p?.latitude), lng=Number(p?.lng??p?.lon??p?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  }
  function ensureSdk() {
    if (!key()) return Promise.reject(new Error('Chưa khai báo CONFIG.GEOAPIFY_BROWSER_KEY.'));
    if (window.L?.map) return Promise.resolve(window.L);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve,reject) => {
      if (!document.getElementById('travelos-leaflet-css')) {
        const link=document.createElement('link');
        link.id='travelos-leaflet-css';link.rel='stylesheet';link.href='vendor/leaflet/leaflet.css?v=1.9.4';
        document.head.appendChild(link);
      }
      const script=document.createElement('script');
      script.src='vendor/leaflet/leaflet.js?v=1.9.4';script.async=true;
      script.onload=()=>window.L?.map?resolve(window.L):reject(new Error('Leaflet tải xong nhưng không khởi tạo được.'));
      script.onerror=()=>{sdkPromise=null;reject(new Error('Không tải được Leaflet fallback.'));};
      document.head.appendChild(script);
    });
    return sdkPromise;
  }
  function tileUrl() {
    return window.L?.Browser?.retina
      ? 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}@2x.png?apiKey={apiKey}'
      : 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}';
  }
  async function createMap(container, center, interactive=true) {
    const L=await ensureSdk(), c=validPoint(center);
    if(!container||!c) throw new Error('Geoapify Map thiếu container/tọa độ.');
    const map=L.map(container,{
      zoomControl:Boolean(interactive), attributionControl:true,
      dragging:Boolean(interactive), touchZoom:Boolean(interactive), scrollWheelZoom:Boolean(interactive),
      doubleClickZoom:Boolean(interactive), boxZoom:Boolean(interactive), keyboard:Boolean(interactive), tap:Boolean(interactive)
    }).setView([c.lat,c.lng],15);
    L.tileLayer(tileUrl(),{
      apiKey:key(),maxZoom:20,
      attribution:'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | © OpenStreetMap <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributors</a>'
    }).addTo(map);
    objectStore.set(map,[]);
    setTimeout(()=>map.invalidateSize?.(),0);
    return map;
  }
  function track(map,obj){const list=objectStore.get(map)||[];list.push(obj);objectStore.set(map,list);return obj;}
  function clearObjects(map){if(!map)return;(objectStore.get(map)||[]).forEach(obj=>{try{map.removeLayer(obj);}catch{}});objectStore.set(map,[]);}
  function pinHtml(label,user=false){return user?'<div class="nearby-pin nearby-pin-user"><span>●</span></div>':`<div class="nearby-pin"><span>${label}</span></div>`;}
  function divIcon(label,user=false){return window.L.divIcon({className:'travelos-leaflet-pin',html:pinHtml(label,user),iconSize:user?[24,24]:[30,36],iconAnchor:user?[12,12]:[15,34]});}
  function fit(map,points,pad=40){if(!points.length)return;if(points.length===1){map.setView([points[0].lat,points[0].lng],16);return;}map.fitBounds(points.map(p=>[p.lat,p.lng]),{padding:[pad,pad],maxZoom:17});}
  function drawNearby(map,payload,onPoiClick){
    if(!window.L||!map)return[];const L=window.L;clearObjects(map);const points=[],objects=[];
    const center=validPoint(payload?.center);
    if(center){points.push(center);objects.push(track(map,L.marker([center.lat,center.lng],{icon:divIcon('●',true),title:'Bạn đang ở đây',zIndexOffset:999}).addTo(map)));}
    (payload?.pois||[]).forEach((poi,index)=>{const p=validPoint(poi);if(!p)return;points.push(p);const marker=L.marker([p.lat,p.lng],{icon:divIcon(index+1),title:String(poi.name||'')}).addTo(map);if(typeof onPoiClick==='function')marker.on('click',()=>onPoiClick(poi,index));objects.push(track(map,marker));});
    fit(map,points,36);return objects;
  }
  function routePath(route){return (Array.isArray(route?.path)?route.path:[]).map(validPoint).filter(Boolean);}
  function drawRoute(map,route,origin,destination){
    if(!window.L||!map)return null;const L=window.L;clearObjects(map);const path=routePath(route),points=[...path],objects=[];
    if(path.length){objects.push(track(map,L.polyline(path.map(p=>[p.lat,p.lng]),{weight:6,opacity:.92,lineCap:'round',lineJoin:'round'}).addTo(map)));}
    const o=validPoint(origin),d=validPoint(destination);
    if(o){points.push(o);objects.push(track(map,L.marker([o.lat,o.lng],{icon:divIcon('●',true),title:'Bắt đầu'}).addTo(map)));}
    if(d){points.push(d);objects.push(track(map,L.marker([d.lat,d.lng],{icon:divIcon('✓'),title:'Điểm đến'}).addTo(map)));}
    fit(map,points,60);return{path,objects};
  }
  function destroy(map){if(!map)return;try{clearObjects(map);map.remove();}catch{}}
  window.GeoapifyMapProvider={ensureSdk,createMap,drawNearby,drawRoute,validPoint,clearObjects,destroy};
})();
