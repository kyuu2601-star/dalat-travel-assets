# TravelOS text chat + Voice Live Translate eval

- Thời điểm: 2026-11-10T07:52:29.434Z
- Translate path: **Gemini Voice Live streaming**
- Tổng: **100**
- Đạt: **68**
- Lỗi: **32**
- Infra: **0**
- Điểm: **68%**
- Gate: **FAIL**

| Nhóm | Case | Đạt | Lỗi | Infra | Điểm |
|---|---:|---:|---:|---:|---:|
| chat-place-current | 5 | 3 | 2 | 0 | 60% |
| chat-place-remote | 5 | 1 | 4 | 0 | 20% |
| chat-route-current | 5 | 4 | 1 | 0 | 80% |
| chat-route-two-point | 5 | 5 | 0 | 0 | 100% |
| chat-weather-current | 5 | 5 | 0 | 0 | 100% |
| chat-weather-remote | 5 | 4 | 1 | 0 | 80% |
| chat-safety | 5 | 2 | 3 | 0 | 40% |
| chat-itinerary | 5 | 0 | 5 | 0 | 0% |
| chat-guided | 5 | 2 | 3 | 0 | 40% |
| chat-utility | 5 | 1 | 4 | 0 | 20% |
| translate-vi-zh | 25 | 21 | 4 | 0 | 84% |
| translate-zh-vi | 25 | 20 | 5 | 0 | 80% |

## Case chưa đạt

### C052 — chat-place-current

- Input: Có bưu điện nào gần chỗ tôi?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs PLACE_DISCOVERY; fresh GPS policy: false vs true; planner intent: LOCAL_GUIDE vs PLACE_DISCOVERY; planner tools: none; need search_places; shadow agreement: false vs true; actual GUIDED_CHAT

### C055 — chat-place-current

- Input: Gần mình có chỗ đổi tiền không?
- Kết quả: FAIL
- Lỗi: planner intent: TRAVEL_UTILITY vs PLACE_DISCOVERY; planner tools: none; need search_places; shadow agreement: false vs true; actual MODEL_ANSWER

### C056 — chat-place-remote

- Input: Tìm quán dimsum ở Quảng Châu
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY

### C057 — chat-place-remote

- Input: Có cửa hàng bán sim tại Bắc Kinh không?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs PLACE_DISCOVERY; planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY; shadow agreement: false vs true; actual API_TOOLS

### C058 — chat-place-remote

- Input: Tìm điểm ngắm cảnh ở Hàng Châu
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY

### C060 — chat-place-remote

- Input: Kiếm quán ăn chay ở Đà Lạt
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs PLACE_DISCOVERY

### C063 — chat-route-current

- Input: Đi tới Hồ Tuyền Lâm thế nào?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs ROUTE_MOBILITY; fresh GPS policy: false vs true; planner intent: LOCAL_GUIDE vs ROUTE_MOBILITY; planner tools: none; need resolve_place; shadow agreement: false vs true; actual GUIDED_CHAT

### C076 — chat-weather-remote

- Input: Ngày mai thời tiết ở Tô Châu thế nào?
- Kết quả: FAIL
- Lỗi: router intent: ROUTE_MOBILITY vs WEATHER_OUTDOOR; fresh GPS policy: true vs false

### C082 — chat-safety

- Input: Tôi bị lạc, cần đồn công an gần nhất
- Kết quả: FAIL
- Lỗi: fresh GPS policy: false vs true; planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### C083 — chat-safety

- Input: Bạn tìm bệnh viện gần vị trí của tôi
- Kết quả: FAIL
- Lỗi: router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs SAFETY_HEALTH

### C085 — chat-safety

- Input: Tôi đánh rơi ví, giúp tìm công an gần tôi
- Kết quả: FAIL
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### C086 — chat-itinerary

- Input: Lên lịch tham quan Đà Lạt trong 3 ngày
- Kết quả: FAIL
- Lỗi: router decision: API_TOOLS vs PLANNER_MODEL; router intent: PLACE_DISCOVERY vs ITINERARY_PLANNING; planner intent: VENUE_INTELLIGENCE vs ITINERARY_PLANNING; planner tools: search_places → place_details → place_busyness; need curated_places

### C087 — chat-itinerary

- Input: Sắp xếp chuyến đi Thượng Hải 2 ngày
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; planner intent: VENUE_INTELLIGENCE vs ITINERARY_PLANNING; planner tools: search_places → place_details → place_busyness; need curated_places; shadow agreement: false vs true; actual API_TOOLS

### C088 — chat-itinerary

- Input: Tạo lịch ăn uống ở Quận 1 một ngày
- Kết quả: FAIL
- Lỗi: router decision: API_TOOLS vs PLANNER_MODEL; router intent: PLACE_DISCOVERY vs ITINERARY_PLANNING; planner intent: VENUE_INTELLIGENCE vs ITINERARY_PLANNING; planner tools: resolve_place → search_places → place_details → place_busyness; need curated_places

### C089 — chat-itinerary

- Input: Gợi ý lịch khám phá Trùng Khánh 3 ngày
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; planner intent: VENUE_INTELLIGENCE vs ITINERARY_PLANNING; planner tools: search_places → place_details → place_busyness; need curated_places; shadow agreement: false vs true; actual API_TOOLS

### C090 — chat-itinerary

- Input: Lên kế hoạch cuối tuần ở Hội An
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; shadow agreement: false vs true; actual PLANNER_MODEL

### C092 — chat-guided

- Input: Kể tui nghe một câu đố vui
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### C093 — chat-guided

- Input: Người Trung Quốc thường chào nhau thế nào?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; shadow agreement: false vs true; actual GUIDED_CHAT

### C094 — chat-guided

- Input: Đi tàu điện ở Trung Quốc có cần xếp hàng không?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; planner intent: VENUE_INTELLIGENCE vs LOCAL_GUIDE; planner tools exact: resolve_place → search_places → place_details → place_busyness vs none; shadow agreement: false vs true; actual API_TOOLS

### C097 — chat-utility

- Input: Cách mua vé tàu cao tốc ở Trung Quốc?
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs TRAVEL_UTILITY; planner tools exact: resolve_place → search_places → place_details → place_busyness vs none; shadow agreement: false vs true; actual API_TOOLS

### C098 — chat-utility

- Input: Tôi muốn gửi vali ở nhà ga
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs TRAVEL_UTILITY; planner tools exact: resolve_place → search_places → place_details → place_busyness vs none; shadow agreement: false vs true; actual API_TOOLS

### C099 — chat-utility

- Input: Có thể dùng eSIM tại Trung Quốc không?
- Kết quả: FAIL
- Lỗi: planner intent: VENUE_INTELLIGENCE vs TRAVEL_UTILITY; planner tools exact: resolve_place → search_places → place_details → place_busyness vs none; shadow agreement: false vs true; actual API_TOOLS

### C100 — chat-utility

- Input: Mẹo giữ an toàn hộ chiếu khi đi du lịch?
- Kết quả: FAIL
- Lỗi: router decision: API_TOOLS vs MODEL_ANSWER; router intent: SAFETY_HEALTH vs TRAVEL_UTILITY; planner intent: SAFETY_HEALTH vs TRAVEL_UTILITY; planner tools exact: search_places vs none

### T055 — translate-vi-zh

- Input: Ga tàu cao tốc ở hướng nào?
- Kết quả: FAIL
- Lỗi: required meaning 1: 高铁站 | 火车站 · 那高铁是往哪个方向？
- Bản dịch thực tế: 那高铁是往哪个方向？

### T065 — translate-vi-zh

- Input: Tôi muốn đi đến bến xe buýt gần nhất.
- Kết quả: FAIL
- Lỗi: required meaning 2: 最近 · 我想去附近的公交车站。
- Bản dịch thực tế: 我想去附近的公交车站。

### T070 — translate-vi-zh

- Input: Cầu này đi bộ qua được không?
- Kết quả: FAIL
- Lỗi: required meaning 1: 桥 · 这句能走过去吗？; required meaning 2: 步行 | 走路 · 这句能走过去吗？
- Bản dịch thực tế: 这句能走过去吗？

### T072 — translate-vi-zh

- Input: Cho hỏi lối ra ở đâu?
- Kết quả: FAIL
- Lỗi: required meaning 2: 哪里 | 哪儿 · 请问出口
- Bản dịch thực tế: 请问出口

### T076 — translate-zh-vi

- Input: 我想买一张去成都的火车票。
- Kết quả: FAIL
- Lỗi: required meaning 2: vé tàu | vé xe lửa · Tôi muốn mua một vé đi Thành Đô.
- Bản dịch thực tế: Tôi muốn mua một vé đi Thành Đô.

### T078 — translate-zh-vi

- Input: 我想在十一点退房。
- Kết quả: FAIL
- Lỗi: required meaning 2: 11 giờ | mười một giờ · Tôi muốn trả phòng lúc 10 giờ.
- Bản dịch thực tế: Tôi muốn trả phòng lúc 10 giờ.

### T081 — translate-zh-vi

- Input: 我需要买晕车药。
- Kết quả: FAIL
- Lỗi: required meaning 1: thuốc say xe · Tôi cần mua thuốc cho bà bầu.
- Bản dịch thực tế: Tôi cần mua thuốc cho bà bầu.

### T087 — translate-zh-vi

- Input: 登机口是几号？
- Kết quả: FAIL
- Lỗi: transcript fidelity: 50% · 登記口是幾號?
- Bản dịch thực tế: Cửa lên máy bay là

### T100 — translate-zh-vi

- Input: 请说慢一点。
- Kết quả: FAIL
- Lỗi: required meaning 3: một chút · Xin hãy nói chậm
- Bản dịch thực tế: Xin hãy nói chậm
