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
    root.innerHTML=`<div class="geo-shell"><div class="geo-map-wrap"><div id="geo-map"></div><div id="geo-status">Đang tải Geoapify...</div></div><aside class="geo-side"><header class="geo-head"><div><span id="geo-provider">GEOAPIFY DRIVING</span><h2 id="geo-title">Điểm đến</h2><p id="geo-summary">Đang tính đường...</p></div><button type="button" class="geo-close">×</button></header><div id="geo-note" class="geo-note">Route và hướng dẫn được lấy trực tiếp từ Geoapify Routing API.</div><div id="geo-routes" class="geo-routes"></div><div id="geo-steps" class="geo-steps"></div></aside></div>`;
    document.body.appendChild(root);$('.geo-close',root).onclick=close;return root;
  }
  function close(){session++;root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('geo-nav-open');document.body.classList.remove('geo-nav-open');try{window.GeoapifyMapProvider?.destroy?.(map);}catch{}map=null;state=null;}
  function originFromApp(){const p=window.userPos,lat=Number(p?.lat),lng=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,coordSystem:'wgs84'}:null;}
  async function fetchRoutes(origin,destination,country,mode){
    const endpoint=mapWorker();if(!endpoint)throw new Error('MAP_WORKER_URL chưa được cấu hình.');
    const response=await fetch(`${endpoint}/route/directions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'geoapify',mode,country,origin,destination,language:'vi'})});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data?.routes?.length)throw new Error(data?.error||`Geoapify Route HTTP ${response.status}`);return data;
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
    const node=$('#geo-routes',root);node.innerHTML=(state.routes||[]).map((r,i)=>`<button type="button" data-route="${i}" aria-pressed="${i===0}"><strong>Tuyến ${i+1}</strong><span>${esc(fmtT(r.duration))} · ${esc(fmtM(r.distance))}</span></button>`).join('');
    node.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>selectRoute(Number(b.dataset.route)));
  }
  async function open(options={}){
    close();const id=++session,info=options.destination||options;
    const destination=window.GeoapifyMapProvider?.validPoint?.(info),origin=window.GeoapifyMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin)throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');if(!destination)throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot();r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('geo-nav-open');document.body.classList.add('geo-nav-open');
    const mode=options.mode==='walk'?'walk':'drive';$('#geo-title',r).textContent=info?.name||'Điểm đến';$('#geo-provider',r).textContent=mode==='drive'?'GEOAPIFY DRIVING':'GEOAPIFY WALKING';$('#geo-note',r).textContent=mode==='drive'?'Tuyến lái xe fallback được lấy từ Geoapify. Bản đồ này chỉ hỗ trợ góc nhìn 2D.':'Route và hướng dẫn đi bộ được lấy từ Geoapify Routing API.';$('#geo-status',r).textContent='Đang tải Geoapify...';$('#geo-status',r).classList.remove('hidden');
    try{
      await window.GeoapifyMapProvider.ensureSdk();if(id!==session)return;
      map=await window.GeoapifyMapProvider.createMap($('#geo-map',r),origin,true);if(id!==session)return;
      const data=await fetchRoutes(origin,{...destination,country:info?.country||''},info?.country||document.getElementById('selectCountry')?.value||'Việt Nam',mode);if(id!==session)return;
      state={origin,destination,routes:data.routes,selected:0,mode};renderChoices();selectRoute(0);$('#geo-status',r).classList.add('hidden');
    }catch(error){if(id!==session)return;$('#geo-status',r).textContent=error.message||'Không mở được Geoapify Navigation.';$('#geo-summary',r).textContent='Không thể tạo route';}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GeoapifyNavigation={open,close};
})();
