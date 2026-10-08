(function () {
  const endpoint=()=>String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');
  const geoKey=()=>String(window.CONFIG?.GEOAPIFY_BROWSER_KEY||'').trim();
  const num=value=>Number(value)||0;
  function stepPath(line,fromIndex,toIndex){
    if(!Array.isArray(line)||!line.length)return[];
    const from=Math.max(0,Math.min(line.length-1,Math.round(Number(fromIndex)||0)));
    const to=Math.max(from,Math.min(line.length-1,Math.round(Number(toIndex)||from)));
    return line.slice(from,to+1).map(pair=>({lng:Number(pair?.[0]),lat:Number(pair?.[1])})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng));
  }
  function normalizeGeoRoute(feature,routeIndex){
    const properties=feature?.properties||{},geometry=feature?.geometry?.coordinates;
    const lines=Array.isArray(geometry?.[0]?.[0])?geometry:(Array.isArray(geometry?.[0])?[geometry]:[]);
    const path=lines.flatMap(line=>(Array.isArray(line)?line:[]).map(pair=>({lng:Number(pair?.[0]),lat:Number(pair?.[1])})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng)));
    const steps=[];
    (Array.isArray(properties.legs)?properties.legs:[]).forEach((leg,legIndex)=>{
      const line=lines[legIndex]||[];
      (Array.isArray(leg?.steps)?leg.steps:[]).forEach(step=>{
        const instruction=step?.instruction||{};
        steps.push({index:steps.length,instruction:String(instruction.text||instruction.transition_instruction||'Tiếp tục'),road:Array.isArray(instruction.streets)?instruction.streets.join(', '):'',distance:num(step?.distance),duration:num(step?.time),action:String(instruction.type||''),path:stepPath(line,step?.from_index,step?.to_index)});
      });
    });
    return{routeIndex,distance:num(properties.distance),duration:num(properties.time),path,steps,provider:'geoapify'};
  }
  async function geoapifyDirect({mode,origin,destination,language}){
    const key=geoKey();if(!key)throw new Error('Route provider chưa được cấu hình.');
    const params=new URLSearchParams({waypoints:`${Number(origin.lat).toFixed(6)},${Number(origin.lng).toFixed(6)}|${Number(destination.lat).toFixed(6)},${Number(destination.lng).toFixed(6)}`,mode:mode==='walk'?'walk':'drive',units:'metric',lang:String(language||'vi').slice(0,10),details:'instruction_details',apiKey:key});
    const response=await fetch(`https://api.geoapify.com/v1/routing?${params}`),raw=await response.json().catch(()=>({}));
    const routes=(Array.isArray(raw?.features)?raw.features:[]).map(normalizeGeoRoute).filter(route=>route.path.length||route.distance>0);
    if(!response.ok||!routes.length)throw new Error(raw?.message||raw?.error||`Geoapify Routing HTTP ${response.status}`);
    return{ok:true,source:'geoapify-routing-v1-browser-fallback',provider:'geoapify',mode,origin,destination,routes,meta:{count:routes.length,browserFallback:true}};
  }
  async function request(options){
    let workerError=null;
    try{
      const base=endpoint();if(!base)throw new Error('MAP_WORKER_URL chưa được cấu hình.');
      const response=await fetch(`${base}/route/directions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)}),data=await response.json().catch(()=>({}));
      if(response.ok&&Array.isArray(data?.routes)&&data.routes.length)return data;
      workerError=new Error(data?.error||`Route Worker HTTP ${response.status}`);
    }catch(error){workerError=error;}
    try{return await geoapifyDirect(options);}catch(error){throw new Error(`${workerError?.message||'Route Worker không khả dụng'}; fallback: ${error.message}`);}
  }
  window.TravelDirections={request};
})();
