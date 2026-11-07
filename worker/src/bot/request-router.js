import { TRAVEL_LANGUAGE_PATTERNS } from './travel-language-knowledge.js';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

const fold=value=>clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d')
  .replace(/Đ/g,'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

const DECISIONS=Object.freeze({
  API_TOOLS:'API_TOOLS',
  PLANNER_MODEL:'PLANNER_MODEL',
  GUIDED_CHAT:'GUIDED_CHAT',
  MODEL_ANSWER:'MODEL_ANSWER'
});

function hasGps(location) {
  const lat=Number(location?.latitude??location?.lat),lng=Number(location?.longitude??location?.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng);
}

function explicitTwoPointRoute(text) {
  return /\btu\s+.{2,80}\s+(?:den|toi|qua)\s+.{2,80}\b/.test(text)&&!/\b(?:vi tri hien tai|day|o day)\b/.test(text);
}

function currentOriginLanguage(text) {
  return TRAVEL_LANGUAGE_PATTERNS.currentOrigin.test(text);
}

function result(decision,intentHint,confidence,requiresFreshGps,reasonCodes) {
  return {
    version:1,
    mode:'shadow',
    applied:false,
    decision,
    intentHint,
    confidence,
    requiresFreshGps,
    reasonCodes
  };
}

/**
 * Predicts the safest execution lane without changing the active request flow.
 * The result intentionally excludes user text and coordinates so it is safe to
 * attach to eval output.
 */
export function shadowRouteTravelRequest({userMessage='',location=null,previousContext=null}={}) {
  const text=fold(userMessage);
  const twoPointRoute=explicitTwoPointRoute(text);
  const currentOrigin=currentOriginLanguage(text);

  if(TRAVEL_LANGUAGE_PATTERNS.itinerary.test(text)&&TRAVEL_LANGUAGE_PATTERNS.itineraryContext.test(text)){
    return result(DECISIONS.PLANNER_MODEL,'ITINERARY_PLANNING',.96,false,['itinerary-language']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.route.test(text)||twoPointRoute){
    return result(DECISIONS.API_TOOLS,'ROUTE_MOBILITY',.98,!twoPointRoute,['route-language',twoPointRoute?'explicit-origin':'current-origin']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.safety.test(text)){
    return result(DECISIONS.API_TOOLS,'SAFETY_HEALTH',.98,currentOrigin||!hasGps(location),['safety-place-search']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.weather.test(text)){
    const remote=(/\b(?:o|tai)\s+.{2,60}\b/.test(text)||TRAVEL_LANGUAGE_PATTERNS.knownDestination.test(text))&&!currentOrigin;
    return result(DECISIONS.API_TOOLS,'WEATHER_OUTDOOR',.95,!remote,['weather-language',remote?'named-destination':'current-location']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.guided.test(text)){
    return result(DECISIONS.GUIDED_CHAT,'LOCAL_GUIDE',.94,false,['guided-travel-chat']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.placeDiscovery.test(text)||TRAVEL_LANGUAGE_PATTERNS.placeType.test(text)){
    const remote=/\b(?:o|tai|khu|quan|huyen|thanh pho)\s+.{2,80}\b/.test(text)&&!currentOrigin;
    return result(DECISIONS.API_TOOLS,'PLACE_DISCOVERY',.92,currentOrigin||(!remote&&!hasGps(location)),['place-search',remote?'named-area':'current-area']);
  }
  if(TRAVEL_LANGUAGE_PATTERNS.venue.test(text)||/\b(?:dia chi|vang)\b/.test(text)){
    return result(DECISIONS.API_TOOLS,'VENUE_INTELLIGENCE',.9,false,[previousContext?'context-or-place-detail':'place-detail']);
  }
  return result(DECISIONS.MODEL_ANSWER,'TRAVEL_UTILITY',.55,false,['ambiguous-existing-flow']);
}

export function compareShadowRoute(router,plan) {
  const tools=Array.isArray(plan?.tools)?plan.tools:[];
  let actualDecision=DECISIONS.MODEL_ANSWER;
  if(plan?.scopeRedirect||(plan?.travelIntent==='LOCAL_GUIDE'&&!tools.length))actualDecision=DECISIONS.GUIDED_CHAT;
  else if(plan?.travelIntent==='ITINERARY_PLANNING'||plan?.isItinerary)actualDecision=DECISIONS.PLANNER_MODEL;
  else if(tools.length)actualDecision=DECISIONS.API_TOOLS;
  return {...router,actualDecision,matched:router?.decision===actualDecision};
}

export { DECISIONS as ROUTER_DECISIONS };
