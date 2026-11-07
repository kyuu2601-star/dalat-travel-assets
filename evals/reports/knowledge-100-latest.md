# TravelOS bot knowledge eval — 100 case mới

- Thời điểm: 2026-11-07T05:43:15.417Z
- Tổng case: **100**
- Đạt: **98**
- Lỗi: **2**
- Điểm: **98%**
- Gate: **FAIL**

| Nhóm | Case | Đạt | Lỗi | Điểm |
|---|---:|---:|---:|---:|
| knowledge-place-current | 10 | 10 | 0 | 100% |
| knowledge-place-remote | 10 | 10 | 0 | 100% |
| knowledge-route-current | 10 | 10 | 0 | 100% |
| knowledge-route-two-point | 10 | 10 | 0 | 100% |
| knowledge-weather-current | 10 | 10 | 0 | 100% |
| knowledge-weather-remote | 10 | 10 | 0 | 100% |
| knowledge-safety | 10 | 8 | 2 | 80% |
| knowledge-itinerary | 10 | 10 | 0 | 100% |
| knowledge-guided | 10 | 10 | 0 | 100% |
| knowledge-false-positive | 10 | 10 | 0 | 100% |

## Case lỗi

### K063 — knowledge-safety

- Câu: Đau đầu dữ dội, cần bác sĩ quanh đây
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### K068 — knowledge-safety

- Câu: Tôi bị bong gân, cần bác sĩ gần mình
- Router: API_TOOLS / SAFETY_HEALTH / GPS=true
- Planner: PLACE_DISCOVERY / search_places
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH
