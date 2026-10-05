(function () {
  let root=null, map=null, state=null, session=0;
  const $ = (s,r=document) => r.querySelector(s);
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtM(m){m=Number(m)||0;return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`;}
  function fmtT(s){s=Number(s)||0;const min=Math.max(1,Math.round(s/60));return min<60?`${min} phút`:`${Math.floor(min/60)} giờ ${min%60} phút`;}
  function mapWorker(){return String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');}
  function ensureRoot(){
    if(root?.isConnected) return root;
    root=document.createElement('div'); root.className='google-nav-modal'; root.setAttribute('aria-hidden','true');
    root.innerHTML=`<div class="gn-shell"><div class="gn-map-wrap"><div id="gn-map"></div><div id="gn-status">Đang tải Google Maps...</div></div><aside class="gn-side"><header class="gn-head"><div><span>GOOGLE ROUTES</span><h2 id="gn-title">Điểm đến</h2><p id="gn-summary">Đang tính đường...</p></div><button type="button" class="gn-close">×</button></header><div class="gn-warning">⚠️ Tuyến đi bộ của Google có thể thiếu một số vỉa hè hoặc lối đi bộ. Hãy đối chiếu thực tế khi di chuyển.</div><div id="gn-routes" class="gn-routes"></div><a id="gn-open-google" class="gn-open-google" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></aside></div>`;
    document.body.appendChild(root); $('.gn-close',root).onclick=close; return root;
  }
  function close(){session++;root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('google-nav-open');document.body.classList.remove('google-nav-open');try{window.GoogleMapProvider?.clearObjects?.(map);}catch{}map=null;state=null;}
  function originFromApp(){const p=window.userPos;const lat=Number(p?.lat),lng=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,coordSystem:'wgs84'}:null;}
  async function fetchRoutes(origin,destination,country){
    const response=await fetch(`${mapWorker()}/route/walking`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'google',country,origin,destination,language:'vi'})});
    const data=await response.json().catch(()=>({})); if(!response.ok||!data?.routes?.length) throw new Error(data?.error||`Google Route HTTP ${response.status}`); return data;
  }
  function selectRoute(index){
    const route=state?.routes?.[index]; if(!route||!map)return; state.selected=index;
    window.GoogleMapProvider.drawRoute(map,route,state.origin,state.destination);
    $('#gn-summary',root).textContent=`${fmtT(route.duration)} · ${fmtM(route.distance)}`;
    $('#gn-routes',root).querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.route)===index)));
  }
  function renderChoices(){
    const node=$('#gn-routes',root); node.innerHTML=(state.routes||[]).map((r,i)=>`<button type="button" data-route="${i}" aria-pressed="${i===0}"><strong>Tuyến ${i+1}</strong><span>${esc(fmtT(r.duration))} · ${esc(fmtM(r.distance))}</span></button>`).join('');
    node.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>selectRoute(Number(b.dataset.route)));
  }
  async function open(options={}){
    close(); const id=++session, destination=window.GoogleMapProvider?.validPoint?.(options.destination||options);
    const info=options.destination||options, origin=window.GoogleMapProvider?.validPoint?.(options.origin)||originFromApp();
    if(!origin) throw new Error('Chưa có GPS hiện tại. Hãy bật Location rồi thử lại.'); if(!destination) throw new Error('Điểm đến không có tọa độ hợp lệ.');
    const r=ensureRoot(); r.classList.add('open');r.setAttribute('aria-hidden','false');document.documentElement.classList.add('google-nav-open');document.body.classList.add('google-nav-open');
    $('#gn-title',r).textContent=info?.name||'Điểm đến';$('#gn-status',r).textContent='Đang tải Google Maps...';$('#gn-status',r).classList.remove('hidden');
    try{
      await window.GoogleMapProvider.ensureSdk(); if(id!==session)return;
      map=await window.GoogleMapProvider.createMap($('#gn-map',r),origin,true); if(id!==session)return;
      const data=await fetchRoutes(origin,{...destination,country:info?.country||''},info?.country||document.getElementById('selectCountry')?.value||'Việt Nam'); if(id!==session)return;
      state={origin,destination,routes:data.routes,selected:0}; renderChoices(); selectRoute(0); $('#gn-status',r).classList.add('hidden');
      const url=window.GoogleMapProvider.directionsUrl(origin,destination), link=$('#gn-open-google',r); link.href=url; link.style.display=url?'block':'none';
    }catch(error){if(id!==session)return;$('#gn-status',r).textContent=error.message||'Không mở được Google Navigation.';$('#gn-summary',r).textContent='Không thể tạo route';}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root?.classList.contains('open'))close();});
  window.GoogleNavigation={open,close};
})();
