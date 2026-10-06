(function () {
  let fullMap=null, fullPayload=null, fullRoot=null, fullProvider='';
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function validPoint(p){const lat=Number(p?.lat??p?.latitude),lng=Number(p?.lng??p?.lon??p?.longitude);return Number.isFinite(lat)&&Number.isFinite(lng)?{...p,lat,lng}:null;}
  function distanceText(v){const m=Number(v);if(!Number.isFinite(m)||m<0)return'';return m<1000?`${Math.max(1,Math.round(m))} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;}
  function providerOf(payload){const raw=String(payload?.provider||payload?.pois?.[0]?.provider||'').toLowerCase();return raw.includes('google')?'google':raw==='geoapify'?'geoapify':'amap';}
  function providerLabel(payload){const provider=providerOf(payload);return provider==='google'?'Google Maps Live':provider==='geoapify'?'Geoapify Fallback':'AMap Live';}
  function currentCity(payload){return payload?.pois?.[0]?.city||document.getElementById('selectCity')?.value||'';}
  function poiDestination(poi,payload){const p=validPoint(poi);return p?{name:poi.name||'',country:poi.country||payload?.center?.country||'',city:poi.city||'',area:poi.district||'',lat:p.lat,lng:p.lng,coordSystem:poi.coordSystem||'wgs84',poiId:poi.poiId||poi.id||''}:null;}
  async function ensureProvider(payload){
    const provider=providerOf(payload);
    if(provider==='google'){
      if(!window.GoogleMapProvider?.ensureSdk) throw new Error('Google Maps module chưa sẵn sàng.');
      await window.GoogleMapProvider.ensureSdk(); return 'google';
    }
    if(provider==='geoapify'){
      if(!window.GeoapifyMapProvider?.ensureSdk) throw new Error('Geoapify map module chưa sẵn sàng.');
      await window.GeoapifyMapProvider.ensureSdk(); return 'geoapify';
    }
    if(window.ChinaNavigation?.ensureLoaded) await window.ChinaNavigation.ensureLoaded(currentCity(payload));
    if(!window.AMapProvider?.ensureSdk) throw new Error('AMap module chưa sẵn sàng.');
    await window.AMapProvider.ensureSdk(); return 'amap';
  }
  function amapPoint(point,country=''){const p=validPoint(point);if(!p)return null;return window.AMapProvider?.toGcj?.({...p,country:p.country||country})||p;}
  function makeAmapMarker(index,user=false){return user?'<div class="nearby-pin nearby-pin-user"><span>●</span></div>':`<div class="nearby-pin"><span>${index+1}</span></div>`;}
  async function mountMap(container,payload,interactive){
    if(!container||!Array.isArray(payload?.pois))return null;
    const provider=await ensureProvider(payload);
    if(provider==='google'){
      const center=validPoint(payload.center)||validPoint(payload.pois[0]);if(!center)throw new Error('Nearby map thiếu tọa độ.');
      const map=await window.GoogleMapProvider.createMap(container,center,interactive);
      window.GoogleMapProvider.drawNearby(map,payload,poi=>interactive&&openRoute(poi,payload));return map;
    }
    if(provider==='geoapify'){
      const center=validPoint(payload.center)||validPoint(payload.pois[0]); if(!center)throw new Error('Nearby map thiếu tọa độ.');
      const map=await window.GeoapifyMapProvider.createMap(container,center,interactive);
      window.GeoapifyMapProvider.drawNearby(map,payload,poi=>interactive&&openRoute(poi,payload)); return map;
    }
    const AMap=window.AMap,country=payload?.center?.country||payload?.pois?.[0]?.country||'',center=amapPoint(payload.center,country)||amapPoint(payload.pois[0],country);
    if(!center)throw new Error('Nearby map thiếu tọa độ.');
    const map=new AMap.Map(container,{zoom:15,center:[center.lng,center.lat],viewMode:'2D',resizeEnable:true,dragEnable:Boolean(interactive),zoomEnable:Boolean(interactive),doubleClickZoom:Boolean(interactive),keyboardEnable:Boolean(interactive),scrollWheel:Boolean(interactive),touchZoom:Boolean(interactive)});
    const markers=[],you=new AMap.Marker({position:[center.lng,center.lat],anchor:'center',content:makeAmapMarker(0,true),zIndex:200});map.add(you);markers.push(you);
    payload.pois.forEach((poi,index)=>{const p=amapPoint(poi,country);if(!p)return;const marker=new AMap.Marker({position:[p.lng,p.lat],anchor:'bottom-center',content:makeAmapMarker(index),title:String(poi.name||'')});marker.on?.('click',()=>interactive&&openRoute(poi,payload));map.add(marker);markers.push(marker);});
    if(markers.length>1)map.setFitView(markers,false,interactive?[70,70,70,70]:[36,36,36,36]);return map;
  }
  function destroyMap(map,provider,container){
    try{if(provider==='amap')map?.destroy?.();else if(provider==='google')window.GoogleMapProvider?.destroy?.(map);else window.GeoapifyMapProvider?.destroy?.(map);}catch{}
    if(container&&provider!=='google')container.innerHTML='';
  }
  function poiRow(poi,index,compact=false){const distance=distanceText(poi.distance),address=poi.address||[poi.district,poi.city].filter(Boolean).join(', '),open=poi.openTime?`<span class="nearby-open">${esc(poi.openTime)}</span>`:'';return `<button type="button" class="nearby-poi-row${compact?' compact':''}" data-nearby-index="${index}"><span class="nearby-poi-index">${index+1}</span><span class="nearby-poi-copy"><strong>${esc(poi.name||'POI')}</strong><small>${esc(address||poi.type||'')}</small><span>${distance?esc(distance):''}${distance&&open?' · ':''}${open}</span></span><span class="nearby-route-arrow">›</span></button>`;}
  function render(payload,messageElement){
    if(!messageElement||!Array.isArray(payload?.pois)||!payload.pois.length)return;
    const card=document.createElement('section');card.className='nearby-chat-card';card.innerHTML=`<div class="nearby-chat-head"><div><span>${esc(providerLabel(payload))}</span><strong>${esc(payload.query||'Nearby')}</strong></div><small>${payload.pois.length} điểm</small></div><div class="nearby-mini-map-wrap"><div class="nearby-mini-map"></div><button type="button" class="nearby-open-map" aria-label="Mở bản đồ Nearby"><span>Mở bản đồ</span></button><div class="nearby-map-loading">Đang tải ${esc(providerLabel(payload))}...</div></div><div class="nearby-chat-list">${payload.pois.slice(0,5).map((p,i)=>poiRow(p,i,true)).join('')}</div>`;messageElement.appendChild(card);
    card.querySelector('.nearby-open-map')?.addEventListener('click',()=>openFull(payload));card.querySelectorAll('[data-nearby-index]').forEach(b=>b.addEventListener('click',()=>openRoute(payload.pois[Number(b.dataset.nearbyIndex)],payload)));
    const mapNode=card.querySelector('.nearby-mini-map'),loading=card.querySelector('.nearby-map-loading');mountMap(mapNode,payload,false).then(()=>loading?.remove()).catch(error=>{console.warn('[TravelNearby mini map]',error);if(loading)loading.textContent=`Không tải được bản đồ · ${error.message||'thử lại sau'}`;});
  }
  function ensureFullRoot(){
    if(fullRoot?.isConnected)return fullRoot;fullRoot=document.createElement('div');fullRoot.className='nearby-full-overlay';fullRoot.setAttribute('aria-hidden','true');fullRoot.innerHTML=`<div class="nearby-full-shell"><header class="nearby-full-head"><div><span id="nearby-full-provider">Live Nearby</span><h2 id="nearby-full-title">Nearby</h2></div><button type="button" class="nearby-full-close">Close</button></header><div class="nearby-full-map-wrap"><div id="nearby-full-map"></div><div id="nearby-full-status">Đang tải bản đồ...</div></div><div id="nearby-full-list" class="nearby-full-list"></div></div>`;document.body.appendChild(fullRoot);fullRoot.querySelector('.nearby-full-close')?.addEventListener('click',closeFull);fullRoot.addEventListener('click',e=>{if(e.target===fullRoot)closeFull();});return fullRoot;
  }
  async function openFull(payload){
    if(!Array.isArray(payload?.pois)||!payload.pois.length)return;const root=ensureFullRoot(),previousProvider=fullProvider,nextProvider=providerOf(payload);fullPayload=payload;root.classList.add('open');root.setAttribute('aria-hidden','false');document.documentElement.classList.add('nearby-map-open');document.body.classList.add('nearby-map-open');
    root.querySelector('#nearby-full-provider').textContent=providerLabel(payload);root.querySelector('#nearby-full-title').textContent=payload.query||'Nearby';const list=root.querySelector('#nearby-full-list');list.innerHTML=payload.pois.map((p,i)=>poiRow(p,i)).join('');list.querySelectorAll('[data-nearby-index]').forEach(b=>b.addEventListener('click',()=>openRoute(payload.pois[Number(b.dataset.nearbyIndex)],payload)));
    const status=root.querySelector('#nearby-full-status'),mapNode=root.querySelector('#nearby-full-map');status.textContent=`Đang tải ${providerLabel(payload)}...`;status.classList.remove('hidden');destroyMap(fullMap,previousProvider,mapNode);fullMap=null;fullProvider=nextProvider;
    try{fullMap=await mountMap(mapNode,payload,true);status.classList.add('hidden');}catch(error){console.warn('[TravelNearby full map]',error);status.textContent=error.message||'Không tải được bản đồ.';}
  }
  function closeFull(){if(!fullRoot)return;const mapNode=fullRoot.querySelector('#nearby-full-map');destroyMap(fullMap,fullProvider,mapNode);fullMap=null;fullPayload=null;fullProvider='';fullRoot.classList.remove('open');fullRoot.setAttribute('aria-hidden','true');document.documentElement.classList.remove('nearby-map-open');document.body.classList.remove('nearby-map-open');}
  async function openRoute(poi,payload=fullPayload){
    const destination=poiDestination(poi,payload);if(!destination)return;const provider=providerOf(payload);closeFull();
    try{
      if(provider==='google'){
        if(!window.GoogleNavigation?.open)throw new Error('Google Navigation module chưa sẵn sàng.');
        await window.GoogleNavigation.open({destination});return;
      }
      if(provider==='geoapify'){
        if(!window.GeoapifyNavigation?.open)throw new Error('Geoapify Navigation module chưa sẵn sàng.');
        await window.GeoapifyNavigation.open({destination});return;
      }
      if(window.ChinaNavigation?.ensureLoaded)await window.ChinaNavigation.ensureLoaded(destination.city||'');
      if(!window.TravelNavigation?.open)throw new Error('AMap Navigation module chưa sẵn sàng.');
      await window.TravelNavigation.open({destination});
    }catch(error){console.error('[TravelNearby route]',error);alert(error.message||'Không mở được điều hướng.');}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullRoot?.classList.contains('open'))closeFull();});
  window.TravelNearby={render,openFull,closeFull,openRoute};
})();
