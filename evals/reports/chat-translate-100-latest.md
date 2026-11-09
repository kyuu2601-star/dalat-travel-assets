# TravelOS text chat + Voice Live Translate eval

- Thời điểm: 2026-11-09T03:14:04.935Z
- Translate path: **Gemini Voice Live streaming**
- Tổng: **100**
- Đạt: **80**
- Lỗi: **20**
- Infra: **0**
- Điểm: **80%**
- Gate: **FAIL**

| Nhóm | Case | Đạt | Lỗi | Infra | Điểm |
|---|---:|---:|---:|---:|---:|
| chat-place-current | 5 | 5 | 0 | 0 | 100% |
| chat-place-remote | 5 | 5 | 0 | 0 | 100% |
| chat-route-current | 5 | 5 | 0 | 0 | 100% |
| chat-route-two-point | 5 | 5 | 0 | 0 | 100% |
| chat-weather-current | 5 | 4 | 1 | 0 | 80% |
| chat-weather-remote | 5 | 5 | 0 | 0 | 100% |
| chat-safety | 5 | 4 | 1 | 0 | 80% |
| chat-itinerary | 5 | 5 | 0 | 0 | 100% |
| chat-guided | 5 | 5 | 0 | 0 | 100% |
| chat-utility | 5 | 5 | 0 | 0 | 100% |
| translate-vi-zh | 25 | 18 | 7 | 0 | 72% |
| translate-zh-vi | 25 | 14 | 11 | 0 | 56% |

## Case chưa đạt

### C025 — chat-weather-current

- Input: Gió quanh vị trí hiện tại có mạnh không?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs WEATHER_OUTDOOR; fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs WEATHER_OUTDOOR; planner tools: resolve_place → search_places → place_details → place_busyness; need weather; shadow agreement: false vs true; actual API_TOOLS

### C034 — chat-safety

- Input: Tôi mất đồ, cần công an gần tôi
- Kết quả: FAIL
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### T003 — translate-vi-zh

- Input: Đi bộ đến đó mất bao lâu?
- Kết quả: FAIL
- Lỗi: required meaning 1: 走路 | 步行 · 走去那里要多久？
- Bản dịch thực tế: 走去那里要多久？

### T009 — translate-vi-zh

- Input: Tôi muốn nhận phòng khách sạn.
- Kết quả: FAIL
- Lỗi: required meaning 2: 入住 | 登记 · 我想办理酒店
- Bản dịch thực tế: 我想办理酒店

### T010 — translate-vi-zh

- Input: Chuyến tàu điện cuối cùng lúc mấy giờ?
- Kết quả: FAIL
- Lỗi: required meaning 2: 地铁 · 最后一班电车是几点？
- Bản dịch thực tế: 最后一班电车是几点？

### T015 — translate-vi-zh

- Input: Khách sạn Yitel nằm ở đường nào?
- Kết quả: FAIL
- Lỗi: required meaning 1: 和颐 | Yitel · Oitel 酒店位于哪条路？
- Bản dịch thực tế: Oitel 酒店位于哪条路？

### T022 — translate-vi-zh

- Input: Xin dừng ở cổng số 2.
- Kết quả: FAIL
- Lỗi: required meaning 2: 停车 | 停 · 请在二号门
- Bản dịch thực tế: 请在二号门

### T023 — translate-vi-zh

- Input: Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.
- Kết quả: FAIL
- Lỗi: required meaning 1: 解放碑 · 我想在七点前去解放; required meaning 3: 晚上 · 我想在七点前去解放
- Bản dịch thực tế: 我想在七点前去解放

### T025 — translate-vi-zh

- Input: Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.
- Kết quả: FAIL
- Lỗi: required meaning 1: 临江支路 · 酒店地址是林江路30号。
- Bản dịch thực tế: 酒店地址是林江路30号。

### T028 — translate-zh-vi

- Input: 走路到那里需要多长时间？
- Kết quả: FAIL
- Lỗi: transcript fidelity: 45% · 走陸道那裡需要多長時間?; required meaning 1: đi bộ · Đi đường bộ thì mất bao lâu?
- Bản dịch thực tế: Đi đường bộ thì mất bao lâu?

### T030 — translate-zh-vi

- Input: 我对花生过敏。
- Kết quả: FAIL
- Lỗi: required meaning 2: đậu phộng | lạc · Tôi bị dị ứng với đậu
- Bản dịch thực tế: Tôi bị dị ứng với đậu

### T035 — translate-zh-vi

- Input: 最后一班地铁是几点？
- Kết quả: FAIL
- Lỗi: transcript fidelity: 44% · 最後一般地鐵是幾點?
- Bản dịch thực tế: Chuyến tàu điện ngầm cuối cùng là mấy giờ?

### T036 — translate-zh-vi

- Input: 我不吃辣。
- Kết quả: FAIL
- Lỗi: required meaning 1: không ăn cay | không cay · Tôi không ăn nữa.
- Bản dịch thực tế: Tôi không ăn nữa.

### T037 — translate-zh-vi

- Input: 请给我一张去重庆北站的票。
- Kết quả: FAIL
- Lỗi: required meaning 2: ga trùng khánh bắc · Cho tôi một vé đi Trùng Khánh Bắc nhé.
- Bản dịch thực tế: Cho tôi một vé đi Trùng Khánh Bắc nhé.

### T040 — translate-zh-vi

- Input: 和颐酒店在哪条路上？
- Kết quả: FAIL
- Lỗi: required meaning 1: yitel | khách sạn hòa di · Khách sạn Hồi Di ở đường nào?
- Bản dịch thực tế: Khách sạn Hồi Di ở đường nào?

### T043 — translate-zh-vi

- Input: 我有两个行李箱和一个背包。
- Kết quả: FAIL
- Lỗi: required meaning 1: hai vali | 2 vali | hai va li · Tôi có hai cái vali và một cái ba lô.; required meaning 2: một ba lô | 1 ba lô · Tôi có hai cái vali và một cái ba lô.
- Bản dịch thực tế: Tôi có hai cái vali và một cái ba lô.

### T045 — translate-zh-vi

- Input: 博物馆几点关门？
- Kết quả: FAIL
- Lỗi: transcript fidelity: 14% · 博古館幾點關門?; required meaning 3: mấy giờ · Bảo tàng đóng cửa lúc
- Bản dịch thực tế: Bảo tàng đóng cửa lúc

### T047 — translate-zh-vi

- Input: 请在二号门停车。
- Kết quả: FAIL
- Lỗi: required meaning 1: cổng số 2 | cổng 2 | cửa số 2 | cửa 2 · Vui lòng đỗ xe ở cổng
- Bản dịch thực tế: Vui lòng đỗ xe ở cổng

### T048 — translate-zh-vi

- Input: 我想在晚上七点前到达解放碑。
- Kết quả: FAIL
- Lỗi: required meaning 1: giải phóng bi | jiefangbei · Tôi muốn vào lúc 7 giờ tối đến đài tưởng niệm giải phóng.
- Bản dịch thực tế: Tôi muốn vào lúc 7 giờ tối đến đài tưởng niệm giải phóng.

### T050 — translate-zh-vi

- Input: 酒店地址是临江支路三十号。
- Kết quả: FAIL
- Lỗi: required meaning 3: lâm giang chi | linjiang · Địa chỉ khách sạn là số 30 đường Lâm Giang,
- Bản dịch thực tế: Địa chỉ khách sạn là số 30 đường Lâm Giang,
