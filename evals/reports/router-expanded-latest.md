# TravelOS expanded router eval

- Thời điểm: 2026-11-06T18:54:18.510Z
- Tổng case: **120**
- Đạt: **73**
- Lỗi: **47**
- Điểm: **60.8%**
- Gate: **FAIL**

| Nhóm | Case | Đạt | Lỗi | Điểm |
|---|---:|---:|---:|---:|
| place-current | 15 | 11 | 4 | 73.3% |
| place-remote | 15 | 11 | 4 | 73.3% |
| route-current | 15 | 7 | 8 | 46.7% |
| route-two-point | 15 | 13 | 2 | 86.7% |
| weather | 15 | 10 | 5 | 66.7% |
| safety-health | 15 | 3 | 12 | 20% |
| itinerary | 15 | 10 | 5 | 66.7% |
| guided-chat | 15 | 8 | 7 | 53.3% |

## Case lỗi

### R006 — place-current

- Câu: Cho tôi tiệm giặt ủi gần đây
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: LOCAL_GUIDE / none
- Lỗi: planner intent: LOCAL_GUIDE vs PLACE_DISCOVERY; planner tools: none; need search_places; shadow agreement: false vs true; actual GUIDED_CHAT

### R011 — place-current

- Câu: Quán cơm nào gần đây?
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: LOCAL_GUIDE / none
- Lỗi: planner intent: LOCAL_GUIDE vs PLACE_DISCOVERY; planner tools: none; need search_places; shadow agreement: false vs true; actual GUIDED_CHAT

### R012 — place-current

- Câu: Tìm cửa hàng tiện lợi gần tôi
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: fresh GPS policy: false vs true

### R014 — place-current

- Câu: Kiếm tiệm bánh gần chỗ đang đứng
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: VENUE_INTELLIGENCE / resolve_place → search_places → place_details → place_busyness
- Lỗi: fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY

### R020 — place-remote

- Câu: Tìm nhà thuốc tại Đà Nẵng
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=false
- Planner: PLACE_DISCOVERY / resolve_place → search_places
- Lỗi: router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY

### R024 — place-remote

- Câu: Tìm bảo tàng ở TP.HCM
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=false
- Planner: PLACE_DISCOVERY / resolve_place → search_places
- Lỗi: router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY

### R026 — place-remote

- Câu: Tìm tiệm bánh ở quận Du Trung
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: VENUE_INTELLIGENCE / resolve_place → search_places → place_details → place_busyness
- Lỗi: planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY

### R027 — place-remote

- Câu: Nhà vệ sinh công cộng tại ga Trùng Khánh Bắc
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: PLACE_DISCOVERY / resolve_place → search_places
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs PLACE_DISCOVERY; shadow agreement: false vs true; actual API_TOOLS

### R037 — route-current

- Câu: Cho tôi route tới Hồng Nhai Động
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: VENUE_INTELLIGENCE / search_places → place_details → place_busyness
- Lỗi: planner intent: VENUE_INTELLIGENCE vs ROUTE_MOBILITY; planner tools: search_places → place_details → place_busyness; need resolve_place

### R039 — route-current

- Câu: Cách đi đến Quảng trường Nhân Dân
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: LOCAL_GUIDE / none
- Lỗi: planner intent: LOCAL_GUIDE vs ROUTE_MOBILITY; planner tools: none; need resolve_place; shadow agreement: false vs true; actual GUIDED_CHAT

### R040 — route-current

- Câu: Đưa tôi tới nhà thuốc gần nhất
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs ROUTE_MOBILITY; planner intent: PLACE_DISCOVERY vs ROUTE_MOBILITY; planner tools: search_places; need resolve_place

### R041 — route-current

- Câu: Tìm đường đến khách sạn Yitel
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: ROUTE_MOBILITY / resolve_place → walking_route
- Lỗi: router intent: PLACE_DISCOVERY vs ROUTE_MOBILITY; fresh GPS policy: false vs true

### R042 — route-current

- Câu: Đi bộ tới ga metro gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: planner tools: search_places → walking_route; need resolve_place

### R043 — route-current

- Câu: Từ chỗ tôi đến trung tâm thương mại gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=false
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: fresh GPS policy: false vs true; planner tools: search_places → walking_route; need resolve_place

### R044 — route-current

- Câu: Chạy xe đến Bến xe Miền Đông
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: VENUE_INTELLIGENCE / search_places → place_details → place_busyness
- Lỗi: planner intent: VENUE_INTELLIGENCE vs ROUTE_MOBILITY; planner tools: search_places → place_details → place_busyness; need resolve_place

### R045 — route-current

- Câu: Dẫn tôi tới bệnh viện gần nhất
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs ROUTE_MOBILITY; fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs ROUTE_MOBILITY; planner tools: search_places; need resolve_place

### R053 — route-two-point

- Câu: Từ ga Trùng Khánh Bắc tới Giải Phóng Bi
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: ROUTE_MOBILITY / resolve_place → walking_route
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs ROUTE_MOBILITY; shadow agreement: false vs true; actual API_TOOLS

### R059 — route-two-point

- Câu: Chỉ đường từ khách sạn đến bảo tàng
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=false
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: planner tools: search_places → walking_route; need resolve_place

### R064 — weather

- Câu: Trời gần đây có tiện đi chơi không?
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: WEATHER_OUTDOOR / weather
- Lỗi: router intent: PLACE_DISCOVERY vs WEATHER_OUTDOOR

### R067 — weather

- Câu: Trùng Khánh ngày mai có mưa không?
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=true
- Planner: WEATHER_OUTDOOR / weather
- Lỗi: fresh GPS policy: true vs false

### R069 — weather

- Câu: Đà Nẵng cuối tuần có nắng không?
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=true
- Planner: WEATHER_OUTDOOR / weather
- Lỗi: fresh GPS policy: true vs false

### R070 — weather

- Câu: Thời tiết ở Vũ Long có tiện đi bộ không?
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: WEATHER_OUTDOOR / resolve_place → weather
- Lỗi: router intent: ROUTE_MOBILITY vs WEATHER_OUTDOOR; fresh GPS policy: true vs false

### R074 — weather

- Câu: Hồ Xuân Hương chiều nay có mưa không?
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=true
- Planner: WEATHER_OUTDOOR / weather
- Lỗi: fresh GPS policy: true vs false

### R077 — safety-health

- Câu: Tôi bị thương khi đang du lịch, bệnh viện gần nhất ở đâu?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R080 — safety-health

- Câu: Tôi bị chảy máu, tìm cơ sở y tế gần nhất
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: VENUE_INTELLIGENCE / search_places → place_details → place_busyness
- Lỗi: fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs SAFETY_HEALTH

### R081 — safety-health

- Câu: Đau ngực khi đi chơi, bệnh viện nào gần đây?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R082 — safety-health

- Câu: Tôi nghi bị ngộ độc thức ăn, tìm nơi trợ giúp
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: VENUE_INTELLIGENCE / search_places → place_details → place_busyness
- Lỗi: fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs SAFETY_HEALTH

### R083 — safety-health

- Câu: Tôi chóng mặt, tìm phòng khám gần nhất
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R084 — safety-health

- Câu: Tôi bị sốt cao, cần bác sĩ gần đây
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R085 — safety-health

- Câu: Tôi bị dị ứng, tìm bệnh viện quanh đây
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R086 — safety-health

- Câu: Bạn tôi bị ngất, cấp cứu ở đâu?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: SAFETY_HEALTH / search_places
- Lỗi: fresh GPS policy: false vs true

### R087 — safety-health

- Câu: Tôi bị tiêu chảy nhẹ, tìm nhà thuốc gần nhất
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R088 — safety-health

- Câu: Tôi cần bác sĩ vì đau đầu dữ dội
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: fresh GPS policy: false vs true; planner intent: LOCAL_GUIDE vs SAFETY_HEALTH; planner tools: none; need search_places; shadow agreement: false vs true; actual GUIDED_CHAT

### R089 — safety-health

- Câu: Bị bong gân khi đi bộ, phòng khám gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / none
- Lỗi: router intent: ROUTE_MOBILITY vs SAFETY_HEALTH; planner intent: ROUTE_MOBILITY vs SAFETY_HEALTH; planner tools: none; need search_places; shadow agreement: false vs true; actual MODEL_ANSWER

### R090 — safety-health

- Câu: Trẻ bị sốt khi du lịch, tìm bệnh viện gần đây
- Router: API_TOOLS / PLACE_DISCOVERY / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R096 — itinerary

- Câu: Plan chuyến đi Thượng Hải 4 ngày
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: ITINERARY_PLANNING / curated_places
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; shadow agreement: false vs true; actual PLANNER_MODEL

### R097 — itinerary

- Câu: Xếp lịch sáng chiều tối ở Trùng Khánh
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: VENUE_INTELLIGENCE / resolve_place → search_places → place_details → place_busyness
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; planner intent: VENUE_INTELLIGENCE vs ITINERARY_PLANNING; planner tools: resolve_place → search_places → place_details → place_busyness; need curated_places; shadow agreement: false vs true; actual API_TOOLS

### R099 — itinerary

- Câu: Lịch trình gia đình ở Đà Nẵng 3 ngày
- Router: PLANNER_MODEL / ITINERARY_PLANNING / GPS=false
- Planner: WEATHER_OUTDOOR / resolve_place → weather
- Lỗi: planner intent: WEATHER_OUTDOOR vs ITINERARY_PLANNING; planner tools: resolve_place → weather; need curated_places; shadow agreement: false vs true; actual API_TOOLS

### R103 — itinerary

- Câu: Lập lịch đi bảo tàng và cà phê trong một ngày
- Router: API_TOOLS / WEATHER_OUTDOOR / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: router decision: API_TOOLS vs PLANNER_MODEL; router intent: WEATHER_OUTDOOR vs ITINERARY_PLANNING; fresh GPS policy: true vs false; planner intent: PLACE_DISCOVERY vs ITINERARY_PLANNING; planner tools: search_places; need curated_places

### R105 — itinerary

- Câu: Sắp xếp lịch trình không quá dày cho Đà Lạt
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: ITINERARY_PLANNING / curated_places
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; shadow agreement: false vs true; actual PLANNER_MODEL

### R112 — guided-chat

- Câu: Có kiêng kỵ gì khi giao tiếp không?
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R113 — guided-chat

- Câu: Nên nói gì khi gặp người địa phương?
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R114 — guided-chat

- Câu: Cách ứng xử khi vào đền chùa
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R115 — guided-chat

- Câu: Phong tục ăn uống ở Trùng Khánh
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R117 — guided-chat

- Câu: Hello Pipi
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R118 — guided-chat

- Câu: Hi Pipi
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### R119 — guided-chat

- Câu: Kể truyền thuyết về thành phố đi
- Router: MODEL_ANSWER / TRAVEL_UTILITY / GPS=false
- Planner: LOCAL_GUIDE / none
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT
