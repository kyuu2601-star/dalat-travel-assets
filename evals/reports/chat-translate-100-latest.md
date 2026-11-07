# TravelOS text chat + translate eval — 100 case mới

- Thời điểm: 2026-11-07T06:32:15.512Z
- Tổng: **100**
- Đạt: **72**
- Lỗi: **28**
- Infra: **0**
- Điểm: **72%**
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
| translate-vi-zh | 25 | 12 | 13 | 0 | 48% |
| translate-zh-vi | 25 | 12 | 13 | 0 | 48% |

## Case chưa đạt

### C025 — chat-weather-current

- Input: Gió quanh vị trí hiện tại có mạnh không?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs WEATHER_OUTDOOR; fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs WEATHER_OUTDOOR; planner tools: resolve_place → search_places → place_details → place_busyness; need weather; shadow agreement: false vs true; actual API_TOOLS

### C034 — chat-safety

- Input: Tôi mất đồ, cần công an gần tôi
- Kết quả: FAIL
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### T002 — translate-vi-zh

- Input: Chỉ đường giúp tôi đến Hồng Nhai Động.
- Kết quả: FAIL
- Lỗi: translation similarity: 32% · 指路帮我到玫瑰咀嚼头。; required meaning 1: 洪崖洞 · 指路帮我到玫瑰咀嚼头。
- Bản dịch thực tế: 指路帮我到玫瑰咀嚼头。

### T005 — translate-vi-zh

- Input: Tôi bị dị ứng đậu phộng.
- Kết quả: FAIL
- Lỗi: required meaning 1: 花生 · 我患有豆类过敏。
- Bản dịch thực tế: 我患有豆类过敏。

### T008 — translate-vi-zh

- Input: Ở đây có thể thanh toán bằng Alipay không?
- Kết quả: FAIL
- Lỗi: required meaning 1: 支付宝 · 这里可以用 Alitai 支付吗?
- Bản dịch thực tế: 这里可以用 Alitai 支付吗?

### T009 — translate-vi-zh

- Input: Tôi muốn nhận phòng khách sạn.
- Kết quả: FAIL
- Lỗi: required meaning 2: 入住 | 登记 · 我想拿起酒店房间。
- Bản dịch thực tế: 我想拿起酒店房间。

### T010 — translate-vi-zh

- Input: Chuyến tàu điện cuối cùng lúc mấy giờ?
- Kết quả: FAIL
- Lỗi: required meaning 2: 地铁 · 最后一次发电时间是几点?
- Bản dịch thực tế: 最后一次发电时间是几点?

### T011 — translate-vi-zh

- Input: Tôi không ăn cay.
- Kết quả: FAIL
- Lỗi: required meaning 1: 不吃辣 | 不要辣 · 我不吃饼干。
- Bản dịch thực tế: 我不吃饼干。

### T012 — translate-vi-zh

- Input: Cho tôi một vé đến ga Trùng Khánh Bắc.
- Kết quả: FAIL
- Lỗi: required meaning 1: 重庆北站 · 给我一张车票去北方。
- Bản dịch thực tế: 给我一张车票去北方。

### T014 — translate-vi-zh

- Input: Tổng cộng là 120 nhân dân tệ đúng không?
- Kết quả: FAIL
- Lỗi: translation similarity: 30% · 总共有120人,不是吗?; required meaning 2: 元 | 人民币 · 总共有120人,不是吗?
- Bản dịch thực tế: 总共有120人,不是吗?

### T015 — translate-vi-zh

- Input: Khách sạn Yitel nằm ở đường nào?
- Kết quả: FAIL
- Lỗi: transcript fidelity: 53% · Khác xã Ui Teo nằm ở đường nào?; required meaning 1: 和颐 | Yitel · 西雅图在哪条街上?; required meaning 2: 路 · 西雅图在哪条街上?
- Bản dịch thực tế: 西雅图在哪条街上?

### T021 — translate-vi-zh

- Input: Trời đang mưa, tôi cần mua ô.
- Kết quả: FAIL
- Lỗi: required meaning 2: 伞 · 现在下雨了,我要买。
- Bản dịch thực tế: 现在下雨了,我要买。

### T023 — translate-vi-zh

- Input: Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.
- Kết quả: FAIL
- Lỗi: required meaning 1: 解放碑 · 我想在晚上7点之前抵达解放。
- Bản dịch thực tế: 我想在晚上7点之前抵达解放。

### T024 — translate-vi-zh

- Input: Có cửa hàng tiện lợi nào mở 24 giờ không?
- Kết quả: FAIL
- Lỗi: required meaning 2: 便利店 · 有没有24小时开放的商店?
- Bản dịch thực tế: 有没有24小时开放的商店?

### T025 — translate-vi-zh

- Input: Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.
- Kết quả: FAIL
- Lỗi: required meaning 1: 临江支路 · 酒店地址是30号林江三路。
- Bản dịch thực tế: 酒店地址是30号林江三路。

### T027 — translate-zh-vi

- Input: 请带我去洪崖洞。
- Kết quả: FAIL
- Lỗi: required meaning 1: hồng nhai động | hongya · Xin hãy đưa tôi đến hố răng đỏ.
- Bản dịch thực tế: Xin hãy đưa tôi đến hố răng đỏ.

### T033 — translate-zh-vi

- Input: 这里可以用支付宝付款吗？
- Kết quả: FAIL
- Lỗi: required meaning 1: alipay | chi phó bảo · Ở đây có thể thanh toán bằng tiền mặt không?
- Bản dịch thực tế: Ở đây có thể thanh toán bằng tiền mặt không?

### T034 — translate-zh-vi

- Input: 我想办理酒店入住。
- Kết quả: FAIL
- Lỗi: required meaning 1: nhận phòng · Tôi muốn quản lý khách sạn.
- Bản dịch thực tế: Tôi muốn quản lý khách sạn.

### T036 — translate-zh-vi

- Input: 我不吃辣。
- Kết quả: FAIL
- Lỗi: required meaning 1: không ăn cay | không cay · Tôi không ăn.
- Bản dịch thực tế: Tôi không ăn.

### T037 — translate-zh-vi

- Input: 请给我一张去重庆北站的票。
- Kết quả: FAIL
- Lỗi: required meaning 2: ga trùng khánh bắc · Vui lòng cho tôi một vé đi Chongqing.
- Bản dịch thực tế: Vui lòng cho tôi một vé đi Chongqing.

### T039 — translate-zh-vi

- Input: 一共是一百二十元，对吗？
- Kết quả: FAIL
- Lỗi: translation similarity: 31% · 120 USD phải không?; required meaning 2: nhân dân tệ | tệ · 120 USD phải không?
- Bản dịch thực tế: 120 USD phải không?

### T040 — translate-zh-vi

- Input: 和颐酒店在哪条路上？
- Kết quả: FAIL
- Lỗi: required meaning 1: yitel | khách sạn hòa di · Khách sạn nào trên đường đi?; required meaning 2: đường nào · Khách sạn nào trên đường đi?
- Bản dịch thực tế: Khách sạn nào trên đường đi?

### T042 — translate-zh-vi

- Input: 请带我去最近的派出所。
- Kết quả: FAIL
- Lỗi: required meaning 1: đồn cảnh sát | đồn công an · Vui lòng đưa tôi đến văn phòng gần nhất.
- Bản dịch thực tế: Vui lòng đưa tôi đến văn phòng gần nhất.

### T043 — translate-zh-vi

- Input: 我有两个行李箱和一个背包。
- Kết quả: FAIL
- Lỗi: required meaning 1: hai vali | 2 vali | hai va li · Tôi có hai hành lý và một túi xách.; required meaning 2: một ba lô | 1 ba lô · Tôi có hai hành lý và một túi xách.
- Bản dịch thực tế: Tôi có hai hành lý và một túi xách.

### T045 — translate-zh-vi

- Input: 博物馆几点关门？
- Kết quả: FAIL
- Lỗi: required meaning 3: mấy giờ · Bảo tàng đóng cửa
- Bản dịch thực tế: Bảo tàng đóng cửa

### T048 — translate-zh-vi

- Input: 我想在晚上七点前到达解放碑。
- Kết quả: FAIL
- Lỗi: required meaning 1: giải phóng bi | jiefangbei · Tôi muốn đến đài giải phóng trước 7 giờ tối.
- Bản dịch thực tế: Tôi muốn đến đài giải phóng trước 7 giờ tối.

### T049 — translate-zh-vi

- Input: 有二十四小时营业的便利店吗？
- Kết quả: FAIL
- Lỗi: required meaning 1: cửa hàng tiện lợi · Có cửa hàng 24 giờ hoạt động không?
- Bản dịch thực tế: Có cửa hàng 24 giờ hoạt động không?

### T050 — translate-zh-vi

- Input: 酒店地址是临江支路三十号。
- Kết quả: FAIL
- Lỗi: required meaning 3: lâm giang chi | linjiang · Địa chỉ khách sạn là Đường 30
- Bản dịch thực tế: Địa chỉ khách sạn là Đường 30
