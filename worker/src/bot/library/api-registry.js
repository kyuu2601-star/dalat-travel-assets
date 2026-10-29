export const API_LIBRARY=Object.freeze({
  PLACE_SEARCH:{available:true,providers:['Google Places API (New)','AMap Place API'],tool:'search_places'},
  PLACE_DETAILS:{available:true,providers:['Google Places API (New)','AMap Place Detail'],tool:'place_details'},
  WEATHER:{available:true,providers:['Google Weather API','AMap Weather','Open-Meteo fallback'],tool:'weather'},
  BUSYNESS:{available:true,providers:['BestTime'],tool:'place_busyness'},
  WALKING_ROUTE:{available:true,providers:['Google Routes API','AMap Route 2.0'],tool:'walking_route'},
  DRIVING_ROUTE:{available:true,providers:['Google Routes API','AMap Route 2.0'],tool:'traffic_route'},
  ITINERARY:{available:true,providers:["Let's Go Pipi D1"],tool:'curated_places'},
  SAFETY_GUIDANCE:{available:true,providers:['Gemini knowledge + verified POI search when requested'],tool:''},
  TRAVEL_UTILITY:{available:true,providers:['Gemini knowledge + map APIs for POIs'],tool:''},
  LOCAL_KNOWLEDGE:{available:true,providers:['Gemini'],tool:''},
  TRANSIT_SCHEDULE:{available:false,providers:[],suggestedProviders:['Google Routes Transit','AMap Public Transit Route 2.0']},
  TICKET_PRICE:{available:false,providers:[],suggestedProviders:['Official venue APIs/sites','Klook affiliate/API','Trip.com affiliate/API']},
  FACT_CHECK:{available:false,providers:[],suggestedProviders:['Gemini Grounding with Google Search','Google Programmable Search','Tavily Search API']},
  CURRENCY_RATE:{available:false,providers:[],suggestedProviders:['Frankfurter API','ExchangeRate-API']},
  PAYMENT_CONNECTIVITY:{available:false,providers:[],suggestedProviders:['Official carrier/payment documentation via search grounding']}
});

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const tool=(name,overrides={})=>({name,query:'',queryEn:'',category:'',placeName:'',address:'',placeId:'',radius:3000,limit:10,language:'vi',latitude:null,longitude:null,destinationLatitude:null,destinationLongitude:null,travelMode:'',curatedType:'general',...overrides});
const genericTarget=value=>['','current_location','selected_place','place_search_result','best_place_result'].includes(clean(value,300).toLowerCase());

export function compileSemanticNeeds(semantic,{language='vi',hasGps=false}={}) {
  const tools=[],unsupported=[];
  const add=item=>{
    const key=[item.name,item.query,item.placeName,item.travelMode].join('|');
    if(!tools.some(existing=>[existing.name,existing.query,existing.placeName,existing.travelMode].join('|')===key))tools.push(item);
  };
  const resolveArea=area=>{if(area)add(tool('resolve_place',{query:area,placeName:area,limit:5,language}));};
  const ensureNamedTarget=(need,{details=false,busyness=false}={})=>{
    const name=clean(need.target||need.query,300);
    if(name&&!genericTarget(name)){
      add(tool('search_places',{query:name,placeName:name,radius:50000,limit:5,language}));
    }
    if(details)add(tool('place_details',{placeName:genericTarget(name)?'':name,radius:50000,language}));
    if(busyness)add(tool('place_busyness',{placeName:genericTarget(name)?'':name,language}));
  };
  for(const need of semantic?.needs||[]){
    const entry=API_LIBRARY[need.kind];
    if(!entry?.available){unsupported.push({...need,suggestedProviders:entry?.suggestedProviders||[]});continue;}
    if(need.kind==='PLACE_SEARCH'){
      resolveArea(need.area);
      const query=clean(need.query||need.target,300);
      if(query)add(tool('search_places',{query,queryEn:language==='zh'?'':clean(need.queryEn,180),radius:3000,limit:10,language}));
    }else if(need.kind==='PLACE_DETAILS')ensureNamedTarget(need,{details:true});
    else if(need.kind==='BUSYNESS')ensureNamedTarget(need,{details:true,busyness:true});
    else if(need.kind==='WEATHER'){
      const place=clean(need.area||(!genericTarget(need.target)?need.target:''),300);
      if(place)add(tool('resolve_place',{query:place,placeName:place,limit:3,language}));
      add(tool('weather',{query:place,language}));
    }else if(need.kind==='WALKING_ROUTE'||need.kind==='DRIVING_ROUTE'){
      const destination=clean(need.target||need.query,300);
      if(destination&&!genericTarget(destination))add(tool('resolve_place',{query:destination,placeName:destination,limit:3,language}));
      add(tool(need.kind==='WALKING_ROUTE'?'walking_route':'traffic_route',{travelMode:need.kind==='WALKING_ROUTE'?'WALK':'DRIVE',language}));
    }else if(need.kind==='ITINERARY')add(tool('curated_places',{query:clean(need.query,300),limit:12,curatedType:'itinerary',language}));
  }
  return {tools:tools.slice(0,8),unsupportedNeeds:unsupported.slice(0,4),canUseCurrentLocation:hasGps};
}

export function missingApiSuggestions(unsupportedNeeds=[]) {
  return unsupportedNeeds.map(item=>({need:item.kind,suggestedProviders:item.suggestedProviders||API_LIBRARY[item.kind]?.suggestedProviders||[]}));
}

