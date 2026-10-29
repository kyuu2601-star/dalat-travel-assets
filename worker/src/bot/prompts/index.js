import { CORE_ANSWER_RULES } from './core.js';
import placeDiscovery from './place-discovery.js';
import weatherOutdoor from './weather-outdoor.js';
import routeMobility from './route-mobility.js';
import itineraryPlanning from './itinerary-planning.js';
import venueIntelligence from './venue-intelligence.js';
import safetyHealth from './safety-health.js';
import travelUtility from './travel-utility.js';
import localGuide from './local-guide.js';
import foodQuality from './food-quality.js';

export const INTENT_PROMPTS = Object.freeze({
  PLACE_DISCOVERY:placeDiscovery,
  WEATHER_OUTDOOR:weatherOutdoor,
  ROUTE_MOBILITY:routeMobility,
  ITINERARY_PLANNING:itineraryPlanning,
  VENUE_INTELLIGENCE:venueIntelligence,
  SAFETY_HEALTH:safetyHealth,
  TRAVEL_UTILITY:travelUtility,
  LOCAL_GUIDE:localGuide
});

export const INTENT_PROFILES = Object.freeze({
  PLACE_DISCOVERY:'Tìm đúng loại, món, thương hiệu hoặc tên riêng và đúng tâm điểm tìm kiếm.',
  WEATHER_OUTDOOR:'Đánh giá thời tiết live và khả năng thực hiện hoạt động ngoài trời.',
  ROUTE_MOBILITY:'Tạo hoặc giải thích tuyến đường theo đúng phương tiện và provider.',
  ITINERARY_PLANNING:'Sắp xếp lịch trình khả thi từ dữ liệu địa điểm đã kiểm chứng.',
  VENUE_INTELLIGENCE:'Đọc chi tiết một địa điểm: mở cửa, rating, review, liên hệ và độ đông.',
  SAFETY_HEALTH:'Ưu tiên hành động an toàn và trợ giúp phù hợp, không chẩn đoán.',
  TRAVEL_UTILITY:'Xử lý các tiện ích thực dụng trong chuyến đi.',
  LOCAL_GUIDE:'Giải thích kiến thức địa phương ổn định như một hướng dẫn viên.'
});

export function answerPromptFor(intent, foodQualitySearch=false) {
  return `${CORE_ANSWER_RULES}\n\n${foodQualitySearch?foodQuality:(INTENT_PROMPTS[intent]||INTENT_PROMPTS.LOCAL_GUIDE)}`;
}

