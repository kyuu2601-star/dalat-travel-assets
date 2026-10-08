(function () {
  let root=null,map=null,state=null,session=0,loadSession=0;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtM=m=>{m=Number(m)||0;return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;};
  const fmtT=s=>{s=Number(s)||0;const min=Math.max(1,Math.round(s/60));return min<60?`${min} phút`:`${Math.floor(min/60)} giờ ${min%60} phút`;};
  const mapWorker=()=>String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');
  function ensureRoot(){
    if(root?.isConnected)return root;
    root=document.createElement('div');root.className='geo-nav-modal';root.setAttribute('aria-hidden','true');
    root.innerHTML=`<div class="geo-shell"><div class="geo-map-wrap"><div class="geo-map-canvas"></div><div class="geo-status">Đang tải Google Maps...</div><div class="google-maneuver" hidden><span class="google-maneuver-icon">↑</span><div><strong>Tiếp tục</strong><small>--</small></div></div><button type="button" class="google-view-toggle" aria-pressed="true">3D</button></div><aside class="geo-side"><header class="geo-head"><div><span class="google-route-provider">GOOGLE DRIVING</span><h2 class="google-route-title">Điểm đến</h2><p class="google-route-summary">Đang tính đường...</p></div><button type="button" class="geo-close" aria-label="Đóng">×</button></header><div class="google-mode-switch" role="group" aria-label="Phương tiện"><button type="button" data-mode="drive" aria-pressed="true">🚗 Ô tô</button><button type="button" data-mode="walk" aria-pressed="false">🚶 Đi bộ</button></div><div class="geo-note google-route-note">Tuyến lái xe có traffic live. Chế độ 3D sẽ xoay camera theo hướng di chuyển khi bắt đầu.</div><div class="geo-routes"></div><div class="geo-steps"></div><div class="google-nav-actions"><button type="button" class="google-start-nav">▶ Bắt đầu dẫn đường 3D</button></div></aside></div>`;
    document.body.appendChild(root);
    $('.geo-close',root).onclick=close;
    $('.google-view-toggle',root).onclick=togglePerspective;
    $('.google-start-nav',root).onclick=toggleTracking;
    root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
    return root;
  }
  function stopTracking(){
    if(state?.watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(state.watchId);
    if(state)state.watchId=null;
    if(map)window.GoogleMapProvider?.clearNavigationPosition?.(map);
    const button=root&&$('.google-start-nav',root);if(button){button.classList.remove('active');button.textContent='▶ Bắt đầu dẫn đường 3D';}
    const maneuver=root&&$('.google-maneuver',root);if(maneuver)maneuver.hidden=true;
  }
  function close(){
    session++;loadSession++;stopTracking();root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('geo-nav-open');document.body.classList.remove('geo-nav-open');
    try{window.GoogleMapProvider?.destroy?.(map);}catch{}map=null;state=null;
  }
  function originFromApp(){const p=window.userPos,lat=Number(p?.lat),lng=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,coordSystem:'wgs84'}:null;}
  async function fetchRoutes(origin,destination,country,mode){
    if(!window.TravelDirections?.request)throw new Error('Route service chưa sẵn sàng.');
    return window.TravelDirections.request({provider:'google',mode,country,origin,destination,language:'vi-VN'});
  }
  function renderSteps(route){
    const node=$('.geo-steps',root),steps=Array.isArray(route?.steps)?route.steps:[];
    if(!steps.length){node.innerHTML='<div class="geo-empty">Provider không trả hướng dẫn từng chặng cho tuyến này.</div>';return;}
    node.innerHTML=steps.map((step,i)=>`<button type="button" class="geo-step" data-step="${i}"><span>${i+1}</span><div><strong>${esc(step.instruction||'Tiếp tục')}</strong><small>${esc([step.road,fmtM(step.distance),fmtT(step.duration)].filter(Boolean).join(' · '))}</small></div></button>`).join('');
    node.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>focusStep(Number(button.dataset.step)));
  }
  function focusStep(index){
    const step=state?.routes?.[state.selected]?.steps?.[index],p=step?.path?.[0];if(!map||!p)return;
    if(state.perspective&&state.mode==='drive'){const next=step.path?.[Math.min(2,step.path.length-1)]||p;window.GoogleMapProvider?.setPerspective?.(map,p,window.GoogleMapProvider?.bearing?.(p,next)||0,true);}
    else window.GoogleMapProvider?.focus?.(map,p,18);
    $('.geo-steps',root).querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===index));
  }
  function selectRoute(index){
    const route=state?.routes?.[index];if(!route||!map)return;state.selected=index;
    window.GoogleMapProvider.drawRoute(map,route,state.origin,state.destination,{perspective:state.perspective&&state.mode==='drive'});
    $('.google-route-summary',root).textContent=`${fmtT(route.duration)} · ${fmtM(route.distance)}${route.staticDuration&&route.duration>route.staticDuration?` · +${fmtT(route.duration-route.staticDuration)} traffic`:''}`;
    $('.geo-routes',root).querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.route)===index)));renderSteps(route);
  }
  function renderChoices(){
    const node=$('.geo-routes',root);node.innerHTML=(state.routes||[]).map((route,i)=>`<button type="button" data-route="${i}" aria-pressed="${i===0}"><strong>Tuyến ${i+1}</strong><span>${esc(fmtT(route.duration))} · ${esc(fmtM(route.distance))}${route.description?` · ${esc(route.description)}`:''}</span></button>`).join('');
    node.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>selectRoute(Number(button.dataset.route)));
  }
  function updateModeUi(){
    root.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)));
    $('.google-route-provider',root).textContent=state.mode==='drive'?'GOOGLE DRIVING':'GOOGLE WALKING';
    $('.google-route-note',root).textContent=state.mode==='drive'?'Tuyến lái xe có traffic live. Chế độ 3D sẽ xoay camera theo hướng di chuyển khi bắt đầu.':'Tuyến đi bộ do Google Routes cung cấp và có thể thiếu vỉa hè hoặc lối dành cho người đi bộ.';
    const view=$('.google-view-toggle',root);view.disabled=state.mode!=='drive';view.setAttribute('aria-pressed',String(state.perspective&&state.mode==='drive'));view.textContent=state.mode==='drive'?(state.perspective?'3D':'2D'):'2D';
    $('.google-start-nav',root).hidden=state.mode!=='drive';
  }
  async function loadRoute(){
    const id=++loadSession;stopTracking();updateModeUi();$('.geo-status',root).textContent=`Đang tính tuyến ${state.mode==='drive'?'lái xe':'đi bộ'}...`;$('.geo-status',root).classList.remove('hidden');$('.google-route-summary',root).textContent='Đang tính đường...';$('.geo-routes',root).innerHTML='';$('.geo-steps',root).innerHTML='';
    try{
      const data=await fetchRoutes(state.origin,{...state.destination,country:state.info?.country||''},state.info?.country||document.getElementById('selectCountry')?.value||'Việt Nam',state.mode);if(id!==loadSession||!state)return;
      const fallback=data.provider==='geoapify';$('.google-route-provider',root).textContent=fallback?'GEOAPIFY FALLBACK':(state.mode==='drive'?'GOOGLE DRIVING':'GOOGLE WALKING');
      if(fallback)$('.google-route-note',root).textContent='Google Routes không khả dụng; tuyến hiện tại được lấy từ Geoapify fallback.';
      state.routes=data.routes;state.selected=0;renderChoices();selectRoute(0);$('.geo-status',root).classList.add('hidden');
    }catch(error){if(id!==loadSession||!state)return;$('.geo-status',root).textContent=error.message||'Không mở được Google Navigation.';$('.google-route-summary',root).textContent='Không thể tạo route';}
  }
  function setMode(mode){if(!state||!['drive','walk'].includes(mode)||state.mode===mode)return;state.mode=mode;state.perspective=mode==='drive';loadRoute();}
  function togglePerspective(){if(!state||state.mode!=='drive')return;state.perspective=!state.perspective;updateModeUi();const route=state.routes?.[state.selected];if(route)selectRoute(state.selected);}
  function haversine(a,b){if(!a||!b)return Infinity;const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function nearestGuidance(position){
    const steps=state?.routes?.[state.selected]?.steps||[];let best={step:null,index:-1,pathIndex:-1,distance:Infinity};
    steps.forEach((step,index)=>(step.path||[]).forEach((point,pathIndex)=>{const distance=haversine(position,point);if(distance<best.distance)best={step,index,pathIndex,distance};}));return best;
  }
  function updateGuidance(position,gpsHeading){
    const guide=nearestGuidance(position),path=guide.step?.path||[],next=path[Math.min(guide.pathIndex+2,path.length-1)],heading=Number.isFinite(Number(gpsHeading))&&Number(gpsHeading)>=0?Number(gpsHeading):(next?window.GoogleMapProvider?.bearing?.(position,next):0)||0;
    window.GoogleMapProvider?.updateNavigationPosition?.(map,position,heading,state.perspective);
    if(guide.index>=0){const panel=$('.google-maneuver',root);panel.hidden=false;$('strong',panel).textContent=guide.step.instruction||'Tiếp tục';$('small',panel).textContent=`${fmtM(guide.distance)} · ${guide.step.road||'trên tuyến'}`;$('.geo-steps',root).querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===guide.index));}
  }
  function toggleTracking(){
    if(!state||state.mode!=='drive'||!state.routes?.length)return;
    if(state.watchId!=null){stopTracking();selectRoute(state.selected);return;}
    if(!navigator.geolocation){$('.geo-status',root).textContent='Thiết bị không hỗ trợ GPS.';$('.geo-status',root).classList.remove('hidden');return;}
    const button=$('.google-start-nav',root);button.classList.add('active');button.textContent='■ Dừng dẫn đường';
    state.watchId=navigator.geolocation.watchPosition(position=>{const point={lat:position.coords.latitude,lng:position.coords.longitude};window.userPos={lat:point.lat,lon:point.lng};$('.geo-status',root).classList.add('hidden');updateGuidance(point,position.coords.heading);},error=>{$('.geo-status',root).textContent=error.code===1?'Cần cho phép Location để bắt đầu dẫn đường.':`GPS: ${error.message}`;$('.geo-status',root).classList.remove('hidden');stopTracking();},{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
  }
  async function open(options={}){
    close();const id=++session,info=options.destination||options,destination=window.GoogleMapProvider?.validPoint?.(info),origin=window.GoogleMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin)throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');if(!destination)throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot();r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('geo-nav-open');document.body.classList.add('geo-nav-open');$('.google-route-title',r).textContent=info?.name||'Điểm đến';$('.geo-status',r).textContent='Đang tải Google Maps...';$('.geo-status',r).classList.remove('hidden');
    state={origin,destination,info,mode:options.mode==='walk'?'walk':'drive',perspective:options.mode!=='walk',routes:[],selected:0,watchId:null};updateModeUi();
    try{await window.GoogleMapProvider.ensureSdk();if(id!==session)return;map=await window.GoogleMapProvider.createMap($('.geo-map-canvas',r),origin,true);if(id!==session)return;await loadRoute();}
    catch(error){if(id!==session)return;if(error?.code==='GOOGLE_MAP_AUTH_FAILED'&&window.GeoapifyNavigation?.open){close();await window.GeoapifyNavigation.open({...options,mode:options.mode==='walk'?'walk':'drive'});return;}$('.geo-status',r).textContent=error.message||'Không mở được Google Navigation.';$('.google-route-summary',r).textContent='Không thể tạo route';}
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GoogleNavigation={open,close};
})();
