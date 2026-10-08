(function () {
  let fullMap=null, fullPayload=null, fullRoot=null, fullProvider='',fullWatchId=null,fullUserMarker=null,fullUserPosition=null;
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function validPoint(p){const lat=Number(p?.lat??p?.latitude),lng=Number(p?.lng??p?.lon??p?.longitude);return Number.isFinite(lat)&&Number.isFinite(lng)?{...p,lat,lng}:null;}
  function distanceText(v){const m=Number(v);if(!Number.isFinite(m)||m<0)return'';return m<1000?`${Math.max(1,Math.round(m))} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;}
  function queryLabel(payload){const q=payload?.query;if(typeof q==='string')return q;return q?.name||q?.keyword||q?.googleType||'Nearby';}
  function providerOf(payload){const raw=String(payload?.provider||payload?.pois?.[0]?.provider||'').toLowerCase();return raw.includes('google')?'google':raw==='geoapify'?'geoapify':'amap';}
  function providerLabel(payload){const provider=providerOf(payload);return provider==='google'?'Google Places · Geoapify Map':provider==='geoapify'?'Geoapify Fallback':'AMap Live';}
  function currentCity(payload){return payload?.pois?.[0]?.city||document.getElementById('selectCity')?.value||'';}
  function poiDestination(poi,payload){const p=validPoint(poi);return p?{name:poi.name||'',address:poi.address||'',country:poi.country||payload?.center?.country||'',city:poi.city||'',area:poi.district||'',lat:p.lat,lng:p.lng,coordSystem:poi.coordSystem||'wgs84',poiId:poi.poiId||poi.id||'',provider:poi.provider||payload?.provider||'',rating:poi.rating||null,userRatingCount:poi.userRatingCount||0,reviews:Array.isArray(poi.reviews)?poi.reviews.slice(0,5):[]}:null;}
  async function ensureProvider(payload){
    const provider=providerOf(payload);
    if(provider==='google'){
      if(!window.GeoapifyMapProvider?.ensureSdk) throw new Error('Geoapify map module chưa sẵn sàng.');
      await window.GeoapifyMapProvider.ensureSdk(); return 'geoapify';
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
  function makeAmapMarker(index,user=false,center=false){return user?'<div class="nearby-pin nearby-pin-user"><span>●</span></div>':center?'<div class="nearby-pin nearby-pin-center"><span>◎</span></div>':`<div class="nearby-pin"><span>${index+1}</span></div>`;}
  async function mountMap(container,payload,interactive){
    if(!container||!Array.isArray(payload?.pois))return null;
    const provider=await ensureProvider(payload);
    if(provider==='geoapify'){
      const center=validPoint(payload.center)||validPoint(payload.pois[0]); if(!center)throw new Error('Nearby map thiếu tọa độ.');
      const map=await window.GeoapifyMapProvider.createMap(container,center,interactive);
      window.GeoapifyMapProvider.drawNearby(map,payload,poi=>interactive&&openRoute(poi,payload)); return map;
    }
    const AMap=window.AMap,country=payload?.center?.country||payload?.pois?.[0]?.country||'',center=amapPoint(payload.center,country)||amapPoint(payload.pois[0],country);
    if(!center)throw new Error('Nearby map thiếu tọa độ.');
    const map=new AMap.Map(container,{zoom:15,center:[center.lng,center.lat],viewMode:'2D',resizeEnable:true,dragEnable:Boolean(interactive),zoomEnable:Boolean(interactive),doubleClickZoom:Boolean(interactive),keyboardEnable:Boolean(interactive),scrollWheel:Boolean(interactive),touchZoom:Boolean(interactive)});
    const markers=[],areaMarker=new AMap.Marker({position:[center.lng,center.lat],anchor:'center',content:makeAmapMarker(0,false,true),title:'Tâm khu vực tìm kiếm',zIndex:200});map.add(areaMarker);markers.push(areaMarker);
    payload.pois.forEach((poi,index)=>{const p=amapPoint(poi,country);if(!p)return;const marker=new AMap.Marker({position:[p.lng,p.lat],anchor:'bottom-center',content:makeAmapMarker(index),title:String(poi.name||'')});marker.on?.('click',()=>interactive&&openRoute(poi,payload));map.add(marker);markers.push(marker);});
    if(markers.length>1)map.setFitView(markers,false,interactive?[70,70,70,70]:[36,36,36,36]);return map;
  }
  function destroyMap(map,provider,container){
    const effective=map?.__travelosProvider||provider;
    try{if(effective==='amap')map?.destroy?.();else if(effective==='google')window.GoogleMapProvider?.destroy?.(map);else window.GeoapifyMapProvider?.destroy?.(map);}catch{}
    if(container&&effective!=='google')container.innerHTML='';
  }
  function poiRow(poi,index,compact=false){const distance=distanceText(poi.distance),address=poi.address||[poi.district,poi.city].filter(Boolean).join(', '),rating=Number(poi.rating),ratingText=Number.isFinite(rating)&&rating>0?`⭐ ${rating.toFixed(1)}${poi.userRatingCount?` (${poi.userRatingCount})`:''}`:'',open=poi.openTime?`<span class="nearby-open">${esc(poi.openTime)}</span>`:'';const meta=[ratingText,distance].filter(Boolean).map(esc).join(' · ');return `<button type="button" class="nearby-poi-row${compact?' compact':''}" data-nearby-index="${index}"><span class="nearby-poi-index">${index+1}</span><span class="nearby-poi-copy"><strong>${esc(poi.name||'POI')}</strong><small>${esc(address||poi.type||'')}</small><span>${meta}${meta&&open?' · ':''}${open}</span></span><span class="nearby-route-arrow">›</span></button>`;}
  function render(payload,messageElement){
    if(!messageElement||!Array.isArray(payload?.pois)||!payload.pois.length)return;
    const card=document.createElement('section');card.className='nearby-chat-card';card.innerHTML=`<div class="nearby-chat-head"><div><span>${esc(providerLabel(payload))}</span><strong>${esc(queryLabel(payload))}</strong></div><small>${payload.pois.length} điểm</small></div><div class="nearby-mini-map-wrap"><div class="nearby-mini-map"></div><button type="button" class="nearby-open-map" aria-label="Mở bản đồ Nearby"><span>Mở bản đồ</span></button><div class="nearby-map-loading">Đang tải ${esc(providerLabel(payload))}...</div></div><div class="nearby-chat-list">${payload.pois.slice(0,5).map((p,i)=>poiRow(p,i,true)).join('')}</div>`;messageElement.appendChild(card);
    card.querySelector('.nearby-open-map')?.addEventListener('click',()=>openFull(payload));card.querySelectorAll('[data-nearby-index]').forEach(b=>b.addEventListener('click',()=>openRoute(payload.pois[Number(b.dataset.nearbyIndex)],payload)));
    const mapNode=card.querySelector('.nearby-mini-map'),loading=card.querySelector('.nearby-map-loading');mountMap(mapNode,payload,false).then(()=>loading?.remove()).catch(error=>{console.warn('[TravelNearby mini map]',error);if(loading)loading.textContent=`Không tải được bản đồ · ${error.message||'thử lại sau'}`;});
  }
  function ensureFullRoot(){
    if(fullRoot?.isConnected)return fullRoot;fullRoot=document.createElement('div');fullRoot.className='nearby-full-overlay';fullRoot.setAttribute('aria-hidden','true');fullRoot.innerHTML=`<div class="nearby-full-shell"><header class="nearby-full-head"><div><span id="nearby-full-provider">Live Nearby</span><h2 id="nearby-full-title">Nearby</h2></div><button type="button" class="nearby-full-close">Đóng</button></header><div class="nearby-full-map-wrap"><div id="nearby-full-map"></div><button type="button" id="nearby-user-location" class="nearby-current-location" hidden>● Vị trí của bạn</button><div id="nearby-full-status">Đang tải bản đồ...</div></div><div id="nearby-full-list" class="nearby-full-list"></div></div>`;document.body.appendChild(fullRoot);fullRoot.querySelector('.nearby-full-close')?.addEventListener('click',closeFull);fullRoot.querySelector('#nearby-user-location')?.addEventListener('click',focusUserPosition);fullRoot.addEventListener('click',e=>{if(e.target===fullRoot)closeFull();});return fullRoot;
  }
  function appPosition(){return validPoint(window.userPos);}
  function showUserPosition(point){const p=validPoint(point);if(!p||!fullMap)return;fullUserPosition=p;const button=fullRoot?.querySelector('#nearby-user-location');if(button)button.hidden=false;if(fullProvider==='google'||fullProvider==='geoapify'){window.GeoapifyMapProvider?.updateNavigationPosition?.(fullMap,p,false);return;}const converted=amapPoint(p,fullPayload?.center?.country||'');if(!converted||!window.AMap)return;if(!fullUserMarker){fullUserMarker=new window.AMap.Marker({position:[converted.lng,converted.lat],anchor:'center',content:makeAmapMarker(0,true),title:'Vị trí hiện tại',zIndex:500});fullMap.add(fullUserMarker);}else fullUserMarker.setPosition?.([converted.lng,converted.lat]);}
  function focusUserPosition(){const p=validPoint(fullUserPosition)||appPosition();if(!p||!fullMap)return;if(fullProvider==='google'||fullProvider==='geoapify')fullMap.setView?.([p.lat,p.lng],16,{animate:true});else{const converted=amapPoint(p,fullPayload?.center?.country||'');if(converted)fullMap.setZoomAndCenter?.(16,[converted.lng,converted.lat]);}}
  function stopFullPositionTracking(){if(fullWatchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(fullWatchId);fullWatchId=null;fullUserMarker=null;fullUserPosition=null;const button=fullRoot?.querySelector('#nearby-user-location');if(button)button.hidden=true;}
  function startFullPositionTracking(){const current=appPosition();if(current)showUserPosition(current);if(!navigator.geolocation)return;fullWatchId=navigator.geolocation.watchPosition(position=>{const point={lat:position.coords.latitude,lng:position.coords.longitude};window.userPos={lat:point.lat,lon:point.lng};showUserPosition(point);},error=>console.warn('[TravelNearby GPS]',error),{enableHighAccuracy:true,maximumAge:5000,timeout:12000});}
  async function openFull(payload){
    if(!Array.isArray(payload?.pois)||!payload.pois.length)return;stopFullPositionTracking();const root=ensureFullRoot(),previousProvider=fullProvider,nextProvider=providerOf(payload);fullPayload=payload;root.classList.add('open');root.setAttribute('aria-hidden','false');document.documentElement.classList.add('nearby-map-open');document.body.classList.add('nearby-map-open');
    root.querySelector('#nearby-full-provider').textContent=providerLabel(payload);root.querySelector('#nearby-full-title').textContent=queryLabel(payload);const list=root.querySelector('#nearby-full-list');list.innerHTML=payload.pois.map((p,i)=>poiRow(p,i)).join('');list.querySelectorAll('[data-nearby-index]').forEach(b=>b.addEventListener('click',()=>openRoute(payload.pois[Number(b.dataset.nearbyIndex)],payload)));
    const status=root.querySelector('#nearby-full-status'),mapNode=root.querySelector('#nearby-full-map');status.textContent=`Đang tải ${providerLabel(payload)}...`;status.classList.remove('hidden');destroyMap(fullMap,previousProvider,mapNode);fullMap=null;fullProvider=nextProvider;
    try{fullMap=await mountMap(mapNode,payload,true);status.classList.add('hidden');startFullPositionTracking();}catch(error){console.warn('[TravelNearby full map]',error);status.textContent=error.message||'Không tải được bản đồ.';}
  }
  function closeFull(){if(!fullRoot)return;stopFullPositionTracking();const mapNode=fullRoot.querySelector('#nearby-full-map');destroyMap(fullMap,fullProvider,mapNode);fullMap=null;fullPayload=null;fullProvider='';fullRoot.classList.remove('open');fullRoot.setAttribute('aria-hidden','true');document.documentElement.classList.remove('nearby-map-open');document.body.classList.remove('nearby-map-open');}
  async function openRoute(poi,payload=fullPayload){
    const destination=poiDestination(poi,payload);if(!destination)return;const provider=providerOf(payload);closeFull();
    try{
      if(provider==='google'||provider==='geoapify'){
        if(!window.GeoapifyNavigation?.open)throw new Error('Geoapify Navigation module chưa sẵn sàng.');
        await window.GeoapifyNavigation.open({destination,mode:'walk',onBack:()=>openFull(payload)});return;
      }
      if(window.ChinaNavigation?.ensureLoaded)await window.ChinaNavigation.ensureLoaded(destination.city||'');
      if(!window.TravelNavigation?.open)throw new Error('AMap Navigation module chưa sẵn sàng.');
      await window.TravelNavigation.open({destination,onBack:()=>openFull(payload)});
    }catch(error){console.error('[TravelNearby route]',error);void openFull(payload);alert(error.message||'Không mở được điều hướng.');}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullRoot?.classList.contains('open'))closeFull();});
  window.TravelNearby={render,openFull,closeFull,openRoute};
})();
