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
    root.innerHTML=`<div class="geo-shell"><div class="geo-map-wrap"><div class="geo-map-canvas"></div><div class="geo-status">Đang tải Google Maps...</div></div><aside class="geo-side"><header class="geo-head"><div><span class="google-route-provider">GOOGLE WALKING</span><h2 class="google-route-title">Điểm đến</h2><p class="google-route-summary">Đang tính đường...</p></div><button type="button" class="geo-close">×</button></header><div class="geo-note google-route-note">Tuyến đi bộ do Google Routes cung cấp. Tuyến đi bộ đang ở trạng thái beta và có thể thiếu vỉa hè hoặc lối dành cho người đi bộ.</div><div class="geo-routes"></div><div class="geo-steps"></div></aside></div>`;
    document.body.appendChild(root);$('.geo-close',root).onclick=close;return root;
  }
  function close(){session++;root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('geo-nav-open');document.body.classList.remove('geo-nav-open');try{window.GoogleMapProvider?.destroy?.(map);}catch{}map=null;state=null;}
  function originFromApp(){const p=window.userPos,lat=Number(p?.lat),lng=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,coordSystem:'wgs84'}:null;}
  async function fetchRoutes(origin,destination,country){
    const endpoint=mapWorker();if(!endpoint)throw new Error('MAP_WORKER_URL chưa được cấu hình.');
    const response=await fetch(`${endpoint}/route/walking`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'google',country,origin,destination,language:'vi-VN'})});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data?.routes?.length)throw new Error(data?.error||`Google Routes HTTP ${response.status}`);return data;
  }
  function renderSteps(route){
    const node=$('.geo-steps',root),steps=Array.isArray(route?.steps)?route.steps:[];
    if(!steps.length){node.innerHTML='<div class="geo-empty">Provider không trả hướng dẫn từng chặng cho tuyến này.</div>';return;}
    node.innerHTML=steps.map((step,i)=>`<button type="button" class="geo-step" data-step="${i}"><span>${i+1}</span><div><strong>${esc(step.instruction||'Tiếp tục')}</strong><small>${esc([step.road,fmtM(step.distance),fmtT(step.duration)].filter(Boolean).join(' · '))}</small></div></button>`).join('');
    node.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>focusStep(Number(button.dataset.step)));
  }
  function focusStep(index){
    const step=state?.routes?.[state.selected]?.steps?.[index],p=step?.path?.[0];if(!map||!p)return;
    window.GoogleMapProvider?.focus?.(map,p,18);
    $('.geo-steps',root).querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===index));
  }
  function selectRoute(index){
    const route=state?.routes?.[index];if(!route||!map)return;state.selected=index;
    window.GoogleMapProvider.drawRoute(map,route,state.origin,state.destination);
    $('.google-route-summary',root).textContent=`${fmtT(route.duration)} · ${fmtM(route.distance)}`;
    $('.geo-routes',root).querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.route)===index)));renderSteps(route);
  }
  function renderChoices(){
    const node=$('.geo-routes',root);node.innerHTML=(state.routes||[]).map((r,i)=>`<button type="button" data-route="${i}" aria-pressed="${i===0}"><strong>Tuyến ${i+1}</strong><span>${esc(fmtT(r.duration))} · ${esc(fmtM(r.distance))}</span></button>`).join('');
    node.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>selectRoute(Number(b.dataset.route)));
  }
  async function open(options={}){
    close();const id=++session,info=options.destination||options;
    const destination=window.GoogleMapProvider?.validPoint?.(info),origin=window.GoogleMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin)throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.');if(!destination)throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot();r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('geo-nav-open');document.body.classList.add('geo-nav-open');
    $('.google-route-title',r).textContent=info?.name||'Điểm đến';$('.geo-status',r).textContent='Đang tải Google Maps...';$('.geo-status',r).classList.remove('hidden');
    try{
      await window.GoogleMapProvider.ensureSdk();if(id!==session)return;
      map=await window.GoogleMapProvider.createMap($('.geo-map-canvas',r),origin,true);if(id!==session)return;
      const data=await fetchRoutes(origin,{...destination,country:info?.country||''},info?.country||document.getElementById('selectCountry')?.value||'Việt Nam');if(id!==session)return;
      const fallback=data.provider==='geoapify';$('.google-route-provider',r).textContent=fallback?'GEOAPIFY FALLBACK':'GOOGLE WALKING';
      $('.google-route-note',r).textContent=fallback?'Google Routes không khả dụng; tuyến hiện tại được lấy từ Geoapify fallback.':'Tuyến đi bộ do Google Routes cung cấp. Tuyến đi bộ đang ở trạng thái beta và có thể thiếu vỉa hè hoặc lối dành cho người đi bộ.';
      state={origin,destination,routes:data.routes,selected:0};renderChoices();selectRoute(0);$('.geo-status',r).classList.add('hidden');
    }catch(error){
      if(id!==session)return;
      if(error?.code==='GOOGLE_MAP_AUTH_FAILED'&&window.GeoapifyNavigation?.open){close();await window.GeoapifyNavigation.open(options);return;}
      $('.geo-status',r).textContent=error.message||'Không mở được Google Navigation.';$('.google-route-summary',r).textContent='Không thể tạo route';
    }
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GoogleNavigation={open,close};
})();
