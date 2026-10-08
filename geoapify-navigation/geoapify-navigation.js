(function () {
  let root=null,map=null,state=null,session=0,summaryAbort=null;
  const $=(s,r=document)=>r.querySelector(s);
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtM(m){m=Number(m)||0;return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;}
  function fmtT(s){s=Number(s)||0;const min=Math.max(1,Math.round(s/60));return min<60?`${min} phút`:`${Math.floor(min/60)} giờ ${min%60} phút`;}
  function mapWorker(){return String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');}
  function aiWorker(){return String(window.CONFIG?.WORKER_URL||'').replace(/\/+$/,'');}
  function ensureRoot(){
    if(root?.isConnected)return root;
    root=document.createElement('div');root.className='geo-nav-modal';root.setAttribute('aria-hidden','true');
    root.innerHTML=`<div class="geo-shell"><div class="geo-map-wrap"><div id="geo-map"></div><div id="geo-status">Đang tải bản đồ...</div><div class="google-maneuver" hidden><span class="google-maneuver-icon">↑</span><div><strong>Tiếp tục</strong><small>--</small></div></div></div><aside class="geo-side"><header class="geo-head"><div><span id="geo-provider">GOOGLE WALKING · GEOAPIFY MAP</span><h2 id="geo-title">Điểm đến</h2><p id="geo-summary">Đang tính đường...</p></div><button type="button" class="geo-close" aria-label="Đóng">×</button></header><div class="google-mode-switch" role="group" aria-label="Phương tiện"><button type="button" data-mode="walk" aria-pressed="true">🚶 Đi bộ</button><button type="button" data-mode="motorbike" aria-pressed="false">🛵 Xe máy</button><button type="button" data-mode="drive" aria-pressed="false">🚗 Ô tô</button></div><section id="geo-note" class="geo-note destination-snapshot" aria-live="polite"><div class="destination-snapshot-loading"><span></span><div><strong>Thông tin điểm đến</strong><small>Đang lấy thời tiết, độ đông và review...</small></div></div></section><div id="geo-routes" class="geo-routes"></div><div id="geo-steps" class="geo-steps"></div><div class="google-nav-actions"><button type="button" class="google-start-nav">📍 Bắt đầu theo dõi vị trí</button></div></aside></div>`;
    document.body.appendChild(root);$('.geo-close',root).onclick=close;$('.google-start-nav',root).onclick=toggleTracking;$('[data-mode="motorbike"]',root).onclick=()=>openGoogleDirections('two-wheeler');$('[data-mode="drive"]',root).onclick=()=>openGoogleDirections('driving');return root;
  }
  function stopTracking(){
    if(state?.watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(state.watchId);
    if(state)state.watchId=null;
    if(map)window.GeoapifyMapProvider?.clearNavigationPosition?.(map);
    const button=root&&$('.google-start-nav',root);if(button){button.classList.remove('active');button.textContent='📍 Bắt đầu theo dõi vị trí';}
    const maneuver=root&&$('.google-maneuver',root);if(maneuver)maneuver.hidden=true;
  }
  function close(){session++;summaryAbort?.abort();summaryAbort=null;stopTracking();root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('geo-nav-open');document.body.classList.remove('geo-nav-open');try{window.GeoapifyMapProvider?.destroy?.(map);}catch{}map=null;state=null;}
  function originFromApp(){const p=window.userPos,lat=Number(p?.lat),lng=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,coordSystem:'wgs84'}:null;}
  async function fetchRoutes(origin,destination,country,mode){
    if(!window.TravelDirections?.request)throw new Error('Route service chưa sẵn sàng.');
    return window.TravelDirections.request({provider:'google',mode:'walk',country,origin,destination,language:'vi-VN'});
  }
  function renderSteps(route){
    const node=$('#geo-steps',root),steps=Array.isArray(route?.steps)?route.steps:[];
    if(!steps.length){node.innerHTML='<div class="geo-empty">Geoapify không trả turn-by-turn cho tuyến này.</div>';return;}
    node.innerHTML=steps.map((step,i)=>`<button type="button" class="geo-step" data-step="${i}"><span>${i+1}</span><div><strong>${esc(step.instruction||'Tiếp tục')}</strong><small>${esc([step.road,fmtM(step.distance),fmtT(step.duration)].filter(Boolean).join(' · '))}</small></div></button>`).join('');
    node.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>focusStep(Number(button.dataset.step)));
  }
  function focusStep(index){
    const step=state?.routes?.[state.selected]?.steps?.[index],p=step?.path?.[0];if(!map||!p)return;
    try{map.setView([p.lat,p.lng],18,{animate:true});}catch{}
    $('#geo-steps',root).querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===index));
  }
  function selectRoute(index){
    const route=state?.routes?.[index];if(!route||!map)return;state.selected=index;
    window.GeoapifyMapProvider.drawRoute(map,route,state.origin,state.destination);
    $('#geo-summary',root).textContent=`${fmtT(route.duration)} · ${fmtM(route.distance)}`;
    $('#geo-routes',root).querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.route)===index)));
    renderSteps(route);
  }
  function renderChoices(){
    const node=$('#geo-routes',root);node.innerHTML=(state.routes||[]).map((r,i)=>`<button type="button" data-route="${i}" aria-pressed="${i===0}"><strong>Tuyến ${i+1}</strong><span>${esc(fmtT(r.duration))} · ${esc(fmtM(r.distance))}${r.description?` · ${esc(r.description)}`:''}</span></button>`).join('');
    node.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>selectRoute(Number(b.dataset.route)));
  }
  function haversine(a,b){if(!a||!b)return Infinity;const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function nearestGuidance(position){
    const steps=state?.routes?.[state.selected]?.steps||[];let best={step:null,index:-1,distance:Infinity};
    steps.forEach((step,index)=>(step.path||[]).forEach(point=>{const distance=haversine(position,point);if(distance<best.distance)best={step,index,distance};}));return best;
  }
  function updateGuidance(position){
    window.GeoapifyMapProvider?.updateNavigationPosition?.(map,position,true);
    const guide=nearestGuidance(position);if(guide.index<0)return;
    const panel=$('.google-maneuver',root);panel.hidden=false;$('strong',panel).textContent=guide.step.instruction||'Tiếp tục';$('small',panel).textContent=`${fmtM(guide.distance)} · ${guide.step.road||'trên tuyến'}`;
    $('#geo-steps',root).querySelectorAll('[data-step]').forEach(button=>button.classList.toggle('active',Number(button.dataset.step)===guide.index));
  }
  function startTracking(){
    if(!state?.routes?.length||state.watchId!=null)return;
    if(!navigator.geolocation){$('#geo-status',root).textContent='Thiết bị không hỗ trợ GPS.';$('#geo-status',root).classList.remove('hidden');return;}
    const button=$('.google-start-nav',root);button.classList.add('active');button.textContent='■ Dừng theo dõi vị trí';
    state.watchId=navigator.geolocation.watchPosition(position=>{const point={lat:position.coords.latitude,lng:position.coords.longitude};window.userPos={lat:point.lat,lon:point.lng};$('#geo-status',root).classList.add('hidden');updateGuidance(point);},error=>{$('#geo-status',root).textContent=error.code===1?'Cần cho phép Location để theo dõi vị trí.':`GPS: ${error.message}`;$('#geo-status',root).classList.remove('hidden');stopTracking();},{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
  }
  function toggleTracking(){if(state?.watchId!=null){stopTracking();selectRoute(state.selected);return;}startTracking();}
  function googleDirectionsUrl(travelMode='driving'){
    const params=new URLSearchParams({api:'1',destination:`${state.destination.lat},${state.destination.lng}`,travelmode:travelMode,dir_action:'navigate'});
    const latestOrigin=originFromApp()||state?.origin;if(latestOrigin)params.set('origin',`${latestOrigin.lat},${latestOrigin.lng}`);
    if(state?.destination?.poiId&&state.destination.provider==='google_places')params.set('destination_place_id',state.destination.poiId);
    return `https://www.google.com/maps/dir/?${params}`;
  }
  function openGoogleDirections(travelMode){
    if(!state)return;const link=document.createElement('a');link.href=googleDirectionsUrl(travelMode);link.target='_blank';link.rel='noopener noreferrer';document.body.appendChild(link);link.click();link.remove();
  }
  function snapshotFallback(info){
    return `<div class="destination-snapshot-title">Tổng quan điểm đến</div><div class="destination-snapshot-grid"><div><small>🌤 Thời tiết</small><strong>Đang tải</strong><span>Google Weather</span></div><div><small>👥 Độ đông</small><strong>Đang tải</strong><span>BestTime live</span></div><div><small>★ Google</small><strong>Đang tải</strong><span>Review ≤ 3 tháng</span></div></div><p>${esc(info?.address||'Đang xác minh thông tin điểm đến...')}</p>`;
  }
  function renderDestinationSnapshot(data,info){
    const weather=data?.weather?.current||{},busyness=data?.busyness||{},place=data?.place||info||{};
    const temperature=Number(weather.temperature),rating=Number(place.recentRating),count=Number(place.recentReviewCount)||0,score=Number(busyness.score);
    const weatherStrong=Number.isFinite(temperature)?`${Math.round(temperature)}°C`:'Chưa có';
    const weatherSub=weather.condition||'Thời tiết hiện tại';
    const crowdStrong=busyness.available?(busyness.label||`${Math.round(score)}%`):'Chưa có';
    const crowdSub=busyness.available?(busyness.basis==='live'?'Hiện tại':'Dự báo theo giờ'):'BestTime chưa có dữ liệu';
    const ratingStrong=Number.isFinite(rating)&&rating>0?`${rating.toFixed(1)}/5`:'Chưa có';
    const ratingSub=count?`${count} review · ≤ 3 tháng`:'Chưa có mẫu ≤ 3 tháng';
    const summary=data?.reviewSummary||fallbackReviewSummary(place);
    $('#geo-note',root).innerHTML=`<div class="destination-snapshot-title">Tổng quan điểm đến</div><div class="destination-snapshot-grid"><div><small>🌤 Thời tiết</small><strong>${esc(weatherStrong)}</strong><span>${esc(weatherSub)}</span></div><div><small>👥 Độ đông</small><strong>${esc(crowdStrong)}</strong><span>${esc(crowdSub)}</span></div><div><small>★ Google</small><strong>${esc(ratingStrong)}</strong><span>${esc(ratingSub)}</span></div></div><p>${esc(summary)}</p>`;
  }
  function fallbackReviewSummary(place){
    const rating=Number(place?.recentRating),count=Number(place?.recentReviewCount)||0;
    if(Number.isFinite(rating)&&rating>0&&count)return `${count} review Google trong 3 tháng gần đây đạt trung bình ${rating.toFixed(1)}/5.`;
    return place?.address||'Google chưa trả review nào trong 3 tháng gần đây.';
  }
  async function fastDestinationSnapshot(info,signal){
    const endpoint=mapWorker();if(!endpoint)return null;const body={name:info.name,address:info.address,country:info.country,placeId:info.poiId,center:{lat:info.lat,lng:info.lng},language:'vi',radius:3000,includeReviews:false};
    const request=(path,payload)=>fetch(`${endpoint}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal}).then(async response=>({response,data:await response.json().catch(()=>({}))}));
    const [placeResult,weatherResult]=await Promise.allSettled([request('/poi/details',body),request('/weather/current',{location:{lat:info.lat,lng:info.lng},language:'vi'})]);
    const place=placeResult.status==='fulfilled'&&placeResult.value.response.ok?placeResult.value.data?.place:null;
    const weather=weatherResult.status==='fulfilled'&&weatherResult.value.response.ok?weatherResult.value.data?.weather:null;
    return place||weather?{ok:true,place:place?{...place,recentRating:null,recentReviewCount:0}:info,weather,busyness:null,reviewSummary:place?.address||info.address||''}:null;
  }
  async function loadDestinationSnapshot(info,id){
    const endpoint=aiWorker();summaryAbort?.abort();summaryAbort=new AbortController();const controller=summaryAbort,timer=setTimeout(()=>controller.abort(),30000);
    $('#geo-note',root).innerHTML=snapshotFallback(info);
    const fastPromise=fastDestinationSnapshot(info,controller.signal).catch(()=>null);
    const fullPromise=endpoint?fetch(`${endpoint}/destination-summary`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:info}),signal:controller.signal}).then(async response=>({response,data:await response.json().catch(()=>({}))})).catch(()=>null):Promise.resolve(null);
    let fast=null;
    try{
      fast=await fastPromise;if(id!==session)return;if(fast)renderDestinationSnapshot(fast,info);
      const full=await fullPromise;if(id!==session)return;if(full?.response?.ok&&full.data?.ok)renderDestinationSnapshot({...full.data,weather:fast?.weather||full.data.weather},info);
    }catch(error){if(error?.name!=='AbortError')console.warn('[Destination snapshot]',error);}
    finally{clearTimeout(timer);if(id===session)summaryAbort=null;}
  }
  async function open(options={}){
    close();const id=++session,info=options.destination||options;
    const destination=window.GeoapifyMapProvider?.validPoint?.(info),origin=window.GeoapifyMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin)throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');if(!destination)throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot();r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('geo-nav-open');document.body.classList.add('geo-nav-open');
    $('#geo-title',r).textContent=info?.name||'Điểm đến';$('#geo-provider',r).textContent='GOOGLE WALKING · GEOAPIFY MAP';$('#geo-note',r).innerHTML='<div class="destination-snapshot-loading"><span></span><div><strong>Thông tin điểm đến</strong><small>Đang lấy thời tiết, độ đông và review...</small></div></div>';$('#geo-status',r).textContent='Đang tải bản đồ...';$('#geo-status',r).classList.remove('hidden');
    void loadDestinationSnapshot({...info,...destination},id);
    try{
      await window.GeoapifyMapProvider.ensureSdk();if(id!==session)return;
      map=await window.GeoapifyMapProvider.createMap($('#geo-map',r),origin,true);if(id!==session)return;
      const data=await fetchRoutes(origin,{...destination,country:info?.country||''},info?.country||document.getElementById('selectCountry')?.value||'Việt Nam','walk');if(id!==session)return;
      state={origin,destination:{...info,...destination},routes:data.routes,selected:0,mode:'walk',watchId:null};
      if(data.provider==='geoapify')$('#geo-provider',r).textContent='GEOAPIFY ROUTE FALLBACK';
      renderChoices();selectRoute(0);$('#geo-status',r).classList.add('hidden');startTracking();
    }catch(error){if(id!==session)return;$('#geo-status',r).textContent=error.message||'Không mở được Geoapify Navigation.';$('#geo-summary',r).textContent='Không thể tạo route';}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GeoapifyNavigation={open,close};
})();
