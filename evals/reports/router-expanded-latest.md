# TravelOS expanded router eval

- Thời điểm: 2026-11-07T05:25:39.794Z
- Tổng case: **120**
- Đạt: **102**
- Lỗi: **18**
- Điểm: **85%**
- Gate: **FAIL**

| Nhóm | Case | Đạt | Lỗi | Điểm |
|---|---:|---:|---:|---:|
| place-current | 15 | 15 | 0 | 100% |
| place-remote | 15 | 15 | 0 | 100% |
| route-current | 15 | 11 | 4 | 73.3% |
| route-two-point | 15 | 15 | 0 | 100% |
| weather | 15 | 14 | 1 | 93.3% |
| safety-health | 15 | 2 | 13 | 13.3% |
| itinerary | 15 | 15 | 0 | 100% |
| guided-chat | 15 | 15 | 0 | 100% |

## Case lỗi

### R040 — route-current

- Câu: Đưa tôi tới nhà thuốc gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: planner tools: search_places → walking_route; need resolve_place

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

### R045 — route-current

- Câu: Dẫn tôi tới bệnh viện gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: planner tools: search_places → walking_route; need resolve_place

### R070 — weather

- Câu: Thời tiết ở Vũ Long có tiện đi bộ không?
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: WEATHER_OUTDOOR / resolve_place → weather
- Lỗi: router intent: ROUTE_MOBILITY vs WEATHER_OUTDOOR; fresh GPS policy: true vs false

### R077 — safety-health

- Câu: Tôi bị thương khi đang du lịch, bệnh viện gần nhất ở đâu?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R079 — safety-health

- Câu: Tôi khó thở, đưa tôi tới bệnh viện
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / search_places → walking_route
- Lỗi: router intent: ROUTE_MOBILITY vs SAFETY_HEALTH; planner intent: ROUTE_MOBILITY vs SAFETY_HEALTH

### R080 — safety-health

- Câu: Tôi bị chảy máu, tìm cơ sở y tế gần nhất
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: SAFETY_HEALTH / search_places
- Lỗi: fresh GPS policy: false vs true

### R081 — safety-health

- Câu: Đau ngực khi đi chơi, bệnh viện nào gần đây?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R082 — safety-health

- Câu: Tôi nghi bị ngộ độc thức ăn, tìm nơi trợ giúp
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: SAFETY_HEALTH / search_places
- Lỗi: fresh GPS policy: false vs true

### R083 — safety-health

- Câu: Tôi chóng mặt, tìm phòng khám gần nhất
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R084 — safety-health

- Câu: Tôi bị sốt cao, cần bác sĩ gần đây
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R085 — safety-health

- Câu: Tôi bị dị ứng, tìm bệnh viện quanh đây
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R086 — safety-health

- Câu: Bạn tôi bị ngất, cấp cứu ở đâu?
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: SAFETY_HEALTH / search_places
- Lỗi: fresh GPS policy: false vs true

### R087 — safety-health

- Câu: Tôi bị tiêu chảy nhẹ, tìm nhà thuốc gần nhất
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### R088 — safety-health

- Câu: Tôi cần bác sĩ vì đau đầu dữ dội
- Router: API_TOOLS / SAFETY_HEALTH / GPS=false
- Planner: SAFETY_HEALTH / search_places
- Lỗi: fresh GPS policy: false vs true

### R089 — safety-health

- Câu: Bị bong gân khi đi bộ, phòng khám gần nhất
- Router: API_TOOLS / ROUTE_MOBILITY / GPS=true
- Planner: ROUTE_MOBILITY / none
- Lỗi: router intent: ROUTE_MOBILITY vs SAFETY_HEALTH; planner intent: ROUTE_MOBILITY vs SAFETY_HEALTH; planner tools: none; need search_places; shadow agreement: false vs true; actual MODEL_ANSWER

### R090 — safety-health

- Câu: Trẻ bị sốt khi du lịch, tìm bệnh viện gần đây
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH
