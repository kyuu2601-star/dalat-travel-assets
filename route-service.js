(function () {
  const endpoint=()=>String(window.CONFIG?.MAP_WORKER_URL||'').replace(/\/+$/,'');
  const geoKey=()=>String(window.CONFIG?.GEOAPIFY_BROWSER_KEY||'').trim();
  const num=value=>Number(value)||0;
  const point=value=>value&&typeof value.lat==='function'?{lat:Number(value.lat()),lng:Number(value.lng())}:{lat:Number(value?.lat),lng:Number(value?.lng)};
  const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
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
    const params=new URLSearchParams({waypoints:`${Number(origin.lat).toFixed(6)},${Number(origin.lng).toFixed(6)}|${Number(destination.lat).toFixed(6)},${Number(destination.lng).toFixed(6)}`,mode:mode==='walk'?'walk':'drive',units:'metric',lang:'en',details:'instruction_details',apiKey:key});
    const response=await fetch(`https://api.geoapify.com/v1/routing?${params}`),raw=await response.json().catch(()=>({}));
    const routes=(Array.isArray(raw?.features)?raw.features:[]).map(normalizeGeoRoute).filter(route=>route.path.length||route.distance>0);
    if(!response.ok||!routes.length)throw new Error(raw?.message||raw?.error||`Geoapify Routing HTTP ${response.status}`);
    return{ok:true,source:'geoapify-routing-v1-browser-fallback',provider:'geoapify',mode,origin,destination,routes,meta:{count:routes.length,browserFallback:true}};
  }
  async function googleBrowserDirections({mode,origin,destination}){
    const maps=window.google?.maps;if(!maps)throw new Error('Google Maps JavaScript chưa sẵn sàng.');
    let DirectionsService=maps.DirectionsService,TravelMode=maps.TravelMode,UnitSystem=maps.UnitSystem,TrafficModel=maps.TrafficModel;
    if((!DirectionsService||!TravelMode)&&typeof maps.importLibrary==='function'){
      const routes=await maps.importLibrary('routes');DirectionsService=routes.DirectionsService||DirectionsService;TravelMode=routes.TravelMode||TravelMode;TrafficModel=routes.TrafficModel||TrafficModel;
    }
    if(!DirectionsService)throw new Error('Google Directions Service chưa được bật cho browser key.');
    const driving=mode!=='walk',request={origin,destination,travelMode:driving?(TravelMode?.DRIVING||'DRIVING'):(TravelMode?.WALKING||'WALKING'),provideRouteAlternatives:driving,unitSystem:UnitSystem?.METRIC||0,...(driving?{drivingOptions:{departureTime:new Date(),trafficModel:TrafficModel?.BEST_GUESS||'bestguess'}}:{})};
    const result=await new Promise((resolve,reject)=>{
      new DirectionsService().route(request,(response,status)=>status==='OK'&&response?resolve(response):reject(new Error(`Google Directions: ${status||'UNKNOWN_ERROR'}`)));
    });
    const routes=(Array.isArray(result?.routes)?result.routes:[]).map((route,routeIndex)=>{
      const legs=Array.isArray(route?.legs)?route.legs:[],rawSteps=legs.flatMap(leg=>Array.isArray(leg?.steps)?leg.steps:[]);
      const steps=rawSteps.map((step,index)=>({index,instruction:plain(step?.instructions)||'Tiếp tục',road:'',distance:num(step?.distance?.value),duration:num(step?.duration?.value),action:String(step?.maneuver||''),path:(Array.isArray(step?.path)?step.path:[]).map(point).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng))}));
      return{routeIndex,distance:legs.reduce((sum,leg)=>sum+num(leg?.distance?.value),0),duration:legs.reduce((sum,leg)=>sum+num(leg?.duration_in_traffic?.value||leg?.duration?.value),0),staticDuration:legs.reduce((sum,leg)=>sum+num(leg?.duration?.value),0),description:plain(route?.summary),path:(Array.isArray(route?.overview_path)?route.overview_path:[]).map(point).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)),steps,provider:'google_directions_js'};
    }).filter(route=>route.path.length||route.distance>0);
    if(!routes.length)throw new Error('Google Directions không trả tuyến.');
    return{ok:true,source:'google-directions-js',provider:'google_directions_js',mode,origin,destination,routes,meta:{count:routes.length,browserFallback:true,trafficAware:driving}};
  }
  async function request(options){
    let workerError=null;
    try{
      const base=endpoint();if(!base)throw new Error('MAP_WORKER_URL chưa được cấu hình.');
      const response=await fetch(`${base}/route/directions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)}),data=await response.json().catch(()=>({}));
      if(response.ok&&Array.isArray(data?.routes)&&data.routes.length)return data;
      workerError=new Error(data?.error||`Route Worker HTTP ${response.status}`);
    }catch(error){workerError=error;}
    let googleError=null;
    if(String(options?.provider||'').toLowerCase().includes('google')){
      try{return await googleBrowserDirections(options);}catch(error){googleError=error;}
    }
    try{return await geoapifyDirect(options);}catch(error){throw new Error(`${workerError?.message||'Route Worker không khả dụng'}; Google browser: ${googleError?.message||'không khả dụng'}; Geoapify: ${error.message}`);}
  }
  window.TravelDirections={request};
})();
