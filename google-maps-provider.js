(function () {
  const objectStore=new WeakMap();
  const layerStore=new WeakMap();
  let sdkPromise=null;
  let authFailed=false;
  const previousAuthFailure=window.gm_authFailure;
  window.gm_authFailure=()=>{authFailed=true;window.dispatchEvent(new Event('travelos-google-map-auth-failed'));if(typeof previousAuthFailure==='function')previousAuthFailure();};

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
  async function createMap(container,center,interactive=true){
    const maps=await ensureSdk(),c=validPoint(center);
    if(!container||!c)throw new Error('Google Map thiếu container/tọa độ.');
    if(authFailed)throw Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'});
    Object.assign(container.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
    const map=new maps.Map(container,{center:c,zoom:15,mapTypeControl:false,streetViewControl:Boolean(interactive),fullscreenControl:Boolean(interactive),zoomControl:Boolean(interactive),gestureHandling:interactive?'greedy':'none',keyboardShortcuts:Boolean(interactive),clickableIcons:false});
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=callback=>value=>{if(settled)return;settled=true;clearTimeout(timeout);callback(value);};
      const succeed=finish(resolve),fail=finish(reject);
      const timeout=setTimeout(()=>fail(Object.assign(new Error('Google Maps không tải được tile; đang chuyển sang bản đồ dự phòng.'),{code:'GOOGLE_MAP_LOAD_TIMEOUT'})),5000);
      maps.event.addListenerOnce(map,'tilesloaded',succeed);
      window.addEventListener('travelos-google-map-auth-failed',()=>fail(Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'})),{once:true});
    });
    if(authFailed)throw Object.assign(new Error('Google Maps từ chối browser key. Kiểm tra Website và API restrictions.'),{code:'GOOGLE_MAP_AUTH_FAILED'});
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
  function drawRoute(map,route,origin,destination){
    if(!window.google?.maps||!map)return null;clearObjects(map);const path=routePath(route),points=[...path],objects=[];
    if(path.length)objects.push(track(map,new window.google.maps.Polyline({map,path,strokeColor:'#0891b2',strokeOpacity:.95,strokeWeight:6}))); 
    const o=validPoint(origin),d=validPoint(destination);
    if(o){points.push(o);objects.push(marker(map,o,'','Bắt đầu',true));}
    if(d){points.push(d);objects.push(marker(map,d,'✓','Điểm đến'));}
    fit(map,points,60);return{path,objects};
  }
  function focus(map,point,zoom=18){const p=validPoint(point);if(!map||!p)return;map.panTo(p);map.setZoom(zoom);}
  function destroy(map){if(!map)return;clearObjects(map);(layerStore.get(map)||[]).forEach(layer=>layer.setMap?.(null));layerStore.delete(map);window.google?.maps?.event?.clearInstanceListeners?.(map);}
  window.GoogleMapProvider={ensureSdk,createMap,drawNearby,drawRoute,validPoint,clearObjects,focus,destroy};
})();
