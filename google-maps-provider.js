(function () {
  const objectStore=new WeakMap();
  const layerStore=new WeakMap();
  const navigationStore=new WeakMap();
  const errorObserverStore=new WeakMap();
  let sdkPromise=null;
  let authFailed=false;
  const previousAuthFailure=window.gm_authFailure;
  function markAuthFailed(){
    authFailed=true;
    window.dispatchEvent(new Event('travelos-google-map-auth-failed'));
  }
  window.gm_authFailure=()=>{markAuthFailed();if(typeof previousAuthFailure==='function')previousAuthFailure();};

  function key(){return String(window.CONFIG?.GOOGLE_MAPS_BROWSER_KEY||'').trim();}
  function validPoint(p){
    const lat=Number(p?.lat??p?.latitude),lng=Number(p?.lng??p?.lon??p?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180?{lat,lng}:null;
  }
  function ensureSdk(){
    if(window.google?.maps?.Map)return Promise.resolve(window.google.maps);
    if(sdkPromise)return sdkPromise;
    if(!key())return Promise.reject(new Error('Chưa khai báo CONFIG.GOOGLE_MAPS_BROWSER_KEY trong config.js.'));
    sdkPromise=new Promise((resolve,reject)=>{
      const callback=`__travelosGoogleMapsReady_${Date.now()}`;
      const script=document.createElement('script');
      window[callback]=()=>{delete window[callback];authFailed?reject(Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'})):resolve(window.google.maps);};
      script.async=true;script.defer=true;
      script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key())}&v=weekly&loading=async&language=vi&region=VN&callback=${callback}`;
      script.onerror=()=>{delete window[callback];sdkPromise=null;reject(new Error('Không tải được Google Maps JavaScript API. Kiểm tra browser key và website restriction.'));};
      document.head.appendChild(script);
    });
    return sdkPromise;
  }
  function track(map,obj){const list=objectStore.get(map)||[];list.push(obj);objectStore.set(map,list);return obj;}
  function clearObjects(map){
    if(!map)return;
    (objectStore.get(map)||[]).forEach(obj=>{try{obj.setMap?.(null);obj.close?.();}catch{}});
    objectStore.set(map,[]);
  }
  function hasGoogleMapError(container){
    return Boolean(container?.querySelector?.('.gm-err-container, .gm-err-content, .gm-err-message'));
  }
  async function createMap(container,center,interactive=true,options={}){
    const maps=await ensureSdk(),c=validPoint(center);
    if(!container||!c)throw new Error('Google Map thiếu container/tọa độ.');
    if(authFailed)throw Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'});
    Object.assign(container.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
    const map=new maps.Map(container,{center:c,zoom:15,mapTypeControl:false,streetViewControl:Boolean(interactive),fullscreenControl:Boolean(interactive),zoomControl:Boolean(interactive),gestureHandling:interactive?'greedy':'none',keyboardShortcuts:Boolean(interactive),clickableIcons:false,...(maps.RenderingType?.VECTOR?{renderingType:maps.RenderingType.VECTOR}:{}),...(options.mapOptions||{})});
    try{await new Promise((resolve,reject)=>{
      let settled=false,timeout=null,readyTimer=null;
      const authError=()=>finish(reject)(Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'}));
      const cleanup=()=>{
        clearTimeout(timeout);
        clearTimeout(readyTimer);
        window.removeEventListener('travelos-google-map-auth-failed',authError);
        idleListener?.remove?.();
        tilesListener?.remove?.();
      };
      const finish=callback=>value=>{if(settled)return;settled=true;cleanup();callback(value);};
      const succeed=finish(resolve);
      const failFromRenderedError=()=>{
        if(!hasGoogleMapError(container))return false;
        markAuthFailed();
        return true;
      };
      const observer=new MutationObserver(failFromRenderedError);
      observer.observe(container,{childList:true,subtree:true,characterData:true});
      errorObserverStore.set(map,observer);
      const ready=()=>{
        if(settled||readyTimer)return;
        // Google can emit `idle` just before replacing the canvas with its
        // authorization error. Give that DOM error a short chance to appear.
        readyTimer=setTimeout(()=>{readyTimer=null;if(!failFromRenderedError())succeed();},1200);
      };
      const idleListener=maps.event.addListenerOnce(map,'idle',ready);
      const tilesListener=maps.event.addListenerOnce(map,'tilesloaded',ready);
      window.addEventListener('travelos-google-map-auth-failed',authError,{once:true});
      // A missing tilesloaded event is not an authentication failure. Slow devices,
      // hidden chat cards and browser privacy features can delay it considerably.
      timeout=setTimeout(ready,10000);
    });}catch(error){destroy(map);throw error;}
    if(authFailed){destroy(map);throw Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'});}
    objectStore.set(map,[]);
    if(interactive){const traffic=new maps.TrafficLayer();traffic.setMap(map);layerStore.set(map,[traffic]);}
    requestAnimationFrame(()=>{maps.event.trigger(map,'resize');map.setCenter(c);});
    return map;
  }
  function marker(map,position,label,title,user=false,onClick){
    const maps=window.google.maps;
    const node=document.createElement('div');node.className=`nearby-pin${user?' nearby-pin-user':''}`;node.title=String(title||'');
    const text=document.createElement('span');text.textContent=user?'●':String(label);node.appendChild(text);
    const wrapper=document.createElement('div');wrapper.style.position='absolute';wrapper.style.transform=user?'translate(-50%,-50%)':'translate(-50%,-100%)';wrapper.style.cursor=onClick?'pointer':'default';wrapper.appendChild(node);
    if(typeof onClick==='function')wrapper.addEventListener('click',onClick);
    const item=new maps.OverlayView();item.onAdd=function(){this.getPanes().overlayMouseTarget.appendChild(wrapper);};item.draw=function(){const p=this.getProjection().fromLatLngToDivPixel(new maps.LatLng(position));wrapper.style.left=`${p.x}px`;wrapper.style.top=`${p.y}px`;};item.onRemove=function(){wrapper.remove();};item.setMap(map);track(map,item);
    return item;
  }
  function fit(map,points,pad=40){
    if(!points.length)return;
    if(points.length===1){map.setCenter(points[0]);map.setZoom(16);return;}
    const bounds=new window.google.maps.LatLngBounds();points.forEach(p=>bounds.extend(p));map.fitBounds(bounds,pad);
  }
  function drawNearby(map,payload,onPoiClick){
    if(!window.google?.maps||!map)return[];clearObjects(map);const points=[],objects=[];
    const center=validPoint(payload?.center);
    if(center){points.push(center);objects.push(marker(map,center,'','Bạn đang ở đây',true));}
    (payload?.pois||[]).forEach((poi,index)=>{const p=validPoint(poi);if(!p)return;points.push(p);objects.push(marker(map,p,index+1,poi.name,false,()=>onPoiClick?.(poi,index)));});
    fit(map,points,36);return objects;
  }
  function routePath(route){return(Array.isArray(route?.path)?route.path:[]).map(validPoint).filter(Boolean);}
  function bearing(a,b){
    const p1=validPoint(a),p2=validPoint(b);if(!p1||!p2)return 0;
    const y=Math.sin((p2.lng-p1.lng)*Math.PI/180)*Math.cos(p2.lat*Math.PI/180);
    const x=Math.cos(p1.lat*Math.PI/180)*Math.sin(p2.lat*Math.PI/180)-Math.sin(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.cos((p2.lng-p1.lng)*Math.PI/180);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  function setPerspective(map,point,heading=0,enabled=true){
    const p=validPoint(point);if(!map||!p)return;
    if(typeof map.moveCamera==='function')map.moveCamera({center:p,zoom:enabled?18.5:16,tilt:enabled?67.5:0,heading:enabled?heading:0});
    else{map.setCenter(p);map.setZoom(enabled?18:16);map.setTilt?.(enabled?45:0);map.setHeading?.(enabled?heading:0);}
  }
  function drawRoute(map,route,origin,destination,options={}){
    if(!window.google?.maps||!map)return null;clearObjects(map);const path=routePath(route),points=[...path],objects=[];
    if(path.length)objects.push(track(map,new window.google.maps.Polyline({map,path,strokeColor:'#0891b2',strokeOpacity:.95,strokeWeight:6}))); 
    const o=validPoint(origin),d=validPoint(destination);
    if(o){points.push(o);objects.push(marker(map,o,'','Bắt đầu',true));}
    if(d){points.push(d);objects.push(marker(map,d,'✓','Điểm đến'));}
    if(options.perspective&&path.length>1)setPerspective(map,validPoint(origin)||path[0],bearing(path[0],path[Math.min(3,path.length-1)]),true);
    else fit(map,points,60);return{path,objects};
  }
  function updateNavigationPosition(map,position,heading=0,perspective=true){
    const p=validPoint(position);if(!map||!p||!window.google?.maps)return null;
    let marker=navigationStore.get(map);
    if(!marker){
      marker=new window.google.maps.Marker({map,zIndex:999,title:'Vị trí hiện tại',icon:{path:window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,scale:7,fillColor:'#22d3ee',fillOpacity:1,strokeColor:'#082f49',strokeWeight:2,rotation:Number(heading)||0}});
      navigationStore.set(map,marker);
    }
    marker.setPosition(p);const icon=marker.getIcon?.();if(icon&&typeof icon==='object')marker.setIcon({...icon,rotation:Number(heading)||0});
    if(perspective)setPerspective(map,p,Number(heading)||0,true);return marker;
  }
  function clearNavigationPosition(map){const marker=navigationStore.get(map);marker?.setMap?.(null);navigationStore.delete(map);}
  function focus(map,point,zoom=18){const p=validPoint(point);if(!map||!p)return;map.panTo(p);map.setZoom(zoom);}
  function destroy(map){if(!map)return;errorObserverStore.get(map)?.disconnect?.();errorObserverStore.delete(map);clearNavigationPosition(map);clearObjects(map);(layerStore.get(map)||[]).forEach(layer=>layer.setMap?.(null));layerStore.delete(map);window.google?.maps?.event?.clearInstanceListeners?.(map);}
  window.GoogleMapProvider={ensureSdk,createMap,drawNearby,drawRoute,validPoint,clearObjects,focus,setPerspective,updateNavigationPosition,clearNavigationPosition,bearing,destroy};
})();
