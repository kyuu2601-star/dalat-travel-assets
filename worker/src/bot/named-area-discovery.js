// A named place is an unconfirmed search center until the traveler chooses a map result.
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/\s+/g,' ').trim();

export function parseNamedAreaRequest(message,remote) {
  if(!remote?.area||!remote?.query)return null;
  const area=String(remote.area).trim().slice(0,300),key=fold(area);
  // Only clearly administrative areas skip confirmation. Every other named
  // center is checked against map results, regardless of its name or country.
  const administrative=/^(?:thanh pho|tp\.?|tinh|quan|huyen|phuong|district|city|province)\b/.test(key)
    ||new Set(['da lat','da nang','ha noi','tp hcm','ho chi minh','sai gon','trung khanh','chongqing','nha trang','hue','hoi an','vung tau','bac kinh','beijing','thuong hai','shanghai']).has(key);
  if(administrative||/^(?:do|day|gan day|cho toi|cho minh|toi|tui|minh)(?:\b|[,;])/.test(key))return null;
  return {area,query:String(remote.query).trim().slice(0,300),radius:Math.min(5000,Math.max(500,Number(remote.radius)||3000)),limit:Math.min(10,Math.max(1,Number(remote.limit)||10)),sortBy:remote.sortBy||'distance'};
}

export function namedAreaMatchScore(requested,place,providerQuery='') {
  const name=fold(place?.localizedName||place?.name),raw=String(place?.name||'');
  const query=fold(requested),tokens=name.split(' ').filter(Boolean),wanted=new Set(query.split(' ').filter(Boolean));
  const shared=tokens.filter(token=>wanted.has(token)).length;
  const latinMatch=tokens.length>=2&&shared/tokens.length>=.8;
  const chineseQuery=String(providerQuery||''),chineseBase=chineseQuery.replace(/(?:大街|广场|景区|市|区)$/u,'');
  const chineseExact=/[\u3400-\u9fff]/u.test(chineseQuery)&&raw===chineseQuery;
  const chineseMatch=/[\u3400-\u9fff]/u.test(chineseQuery)
    && (raw.includes(chineseQuery)||chineseBase.length>=2&&raw.includes(chineseBase));
  const distinctive=token=>token.length>=4&&!new Set(['hotel','khach','quan','thanh','pho','cong','vien','trung','khanh','city','place','store','lake','park','market']).has(token);
  const brandMatch=query.split(' ').some(token=>distinctive(token)&&tokens.includes(token));
  if(!latinMatch&&!chineseMatch&&!brandMatch)return 0;
  const address=fold(`${place?.address||''} ${place?.city||''}`);
  const leftover=query.replace(name,'').trim();
  const areaFit=leftover&&address.includes(leftover)?20:0;
  return (latinMatch?shared/tokens.length*100:chineseExact?110:chineseMatch?85:80)+areaFit+Math.min(tokens.length,8);
}
