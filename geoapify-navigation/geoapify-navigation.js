(function () {
  let root=null,map=null,state=null,session=0;
  const $=(s,r=document)=>r.querySelector(s);
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtM(m){m=Number(m)||0;return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;}
  function fmtT(s){s=Number(s)||0;const min=Math.max(1,Math.round(s/60));return min<60?`${min} phút`:`${Math.floor(min/60)} giờ ${min%60} phút`;}
  function mapWorker(){return String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');}
  function ensureRoot(){
    if(root?.isConnected)return root;
    root=document.createElement('div');root.className='geo-nav-modal';root.setAttribute('aria-hidden','true');
    root.innerHTML=`<div class="geo-shell"><div class="geo-map-wrap"><div id="geo-map"></div><div id="geo-status">Đang tải bản đồ...</div><div class="google-maneuver" hidden><span class="google-maneuver-icon">↑</span><div><strong>Tiếp tục</strong><small>--</small></div></div></div><aside class="geo-side"><header class="geo-head"><div><span id="geo-provider">GOOGLE WALKING · GEOAPIFY MAP</span><h2 id="geo-title">Điểm đến</h2><p id="geo-summary">Đang tính đường...</p></div><button type="button" class="geo-close" aria-label="Đóng">×</button></header><div class="google-mode-switch" role="group" aria-label="Phương tiện"><button type="button" data-mode="walk" aria-pressed="true">🚶 Đi bộ</button><button type="button" data-mode="drive" aria-pressed="false">🚗 Ô tô</button></div><div id="geo-note" class="geo-note">Google tính tuyến và hướng dẫn; Geoapify chỉ hiển thị bản đồ 2D.</div><div id="geo-routes" class="geo-routes"></div><div id="geo-steps" class="geo-steps"></div><div class="google-nav-actions"><button type="button" class="google-start-nav">📍 Bắt đầu theo dõi vị trí</button></div></aside></div>`;
    document.body.appendChild(root);$('.geo-close',root).onclick=close;$('.google-start-nav',root).onclick=toggleTracking;$('[data-mode="drive"]',root).onclick=openGoogleDriving;return root;
  }
  function stopTracking(){
    if(state?.watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(state.watchId);
    if(state)state.watchId=null;
    if(map)window.GeoapifyMapProvider?.clearNavigationPosition?.(map);
    const button=root&&$('.google-start-nav',root);if(button){button.classList.remove('active');button.textContent='📍 Bắt đầu theo dõi vị trí';}
    const maneuver=root&&$('.google-maneuver',root);if(maneuver)maneuver.hidden=true;
  }
  function close(){session++;stopTracking();root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('geo-nav-open');document.body.classList.remove('geo-nav-open');try{window.GeoapifyMapProvider?.destroy?.(map);}catch{}map=null;state=null;}
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
  function googleDirectionsUrl(){
    const params=new URLSearchParams({api:'1',destination:`${state.destination.lat},${state.destination.lng}`,travelmode:'driving',dir_action:'navigate'});
    if(state?.origin)params.set('origin',`${state.origin.lat},${state.origin.lng}`);
    return `https://www.google.com/maps/dir/?${params}`;
  }
  function openGoogleDriving(){
    if(!state)return;const link=document.createElement('a');link.href=googleDirectionsUrl();link.target='_blank';link.rel='noopener noreferrer';document.body.appendChild(link);link.click();link.remove();
  }
  async function open(options={}){
    close();const id=++session,info=options.destination||options;
    const destination=window.GeoapifyMapProvider?.validPoint?.(info),origin=window.GeoapifyMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin)throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');if(!destination)throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot();r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('geo-nav-open');document.body.classList.add('geo-nav-open');
    $('#geo-title',r).textContent=info?.name||'Điểm đến';$('#geo-provider',r).textContent='GOOGLE WALKING · GEOAPIFY MAP';$('#geo-note',r).textContent='Google tính tuyến và hướng dẫn; Geoapify chỉ hiển thị bản đồ 2D. Vị trí của bạn sẽ được theo dõi khi tuyến tải xong.';$('#geo-status',r).textContent='Đang tải bản đồ...';$('#geo-status',r).classList.remove('hidden');
    try{
      await window.GeoapifyMapProvider.ensureSdk();if(id!==session)return;
      map=await window.GeoapifyMapProvider.createMap($('#geo-map',r),origin,true);if(id!==session)return;
      const data=await fetchRoutes(origin,{...destination,country:info?.country||''},info?.country||document.getElementById('selectCountry')?.value||'Việt Nam','walk');if(id!==session)return;
      state={origin,destination,routes:data.routes,selected:0,mode:'walk',watchId:null};
      if(data.provider==='geoapify'){$('#geo-provider',r).textContent='GEOAPIFY ROUTE FALLBACK';$('#geo-note',r).textContent='Google Routes tạm không khả dụng; đang dùng tuyến Geoapify và bản đồ 2D.';}
      renderChoices();selectRoute(0);$('#geo-status',r).classList.add('hidden');startTracking();
    }catch(error){if(id!==session)return;$('#geo-status',r).textContent=error.message||'Không mở được Geoapify Navigation.';$('#geo-summary',r).textContent='Không thể tạo route';}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GeoapifyNavigation={open,close};
})();
