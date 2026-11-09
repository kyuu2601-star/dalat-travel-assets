# TravelOS text chat + Voice Live Translate eval

- Thời điểm: 2026-11-09T02:52:43.735Z
- Translate path: **Gemini Voice Live streaming**
- Tổng: **100**
- Đạt: **54**
- Lỗi: **23**
- Infra: **23**
- Điểm: **54%**
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
| translate-vi-zh | 25 | 4 | 17 | 4 | 16% |
| translate-zh-vi | 25 | 2 | 4 | 19 | 8% |

## Case chưa đạt

### C025 — chat-weather-current

- Input: Gió quanh vị trí hiện tại có mạnh không?
- Kết quả: FAIL
- Lỗi: router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs WEATHER_OUTDOOR; fresh GPS policy: false vs true; planner intent: VENUE_INTELLIGENCE vs WEATHER_OUTDOOR; planner tools: resolve_place → search_places → place_details → place_busyness; need weather; shadow agreement: false vs true; actual API_TOOLS

### C034 — chat-safety

- Input: Tôi mất đồ, cần công an gần tôi
- Kết quả: FAIL
- Lỗi: planner intent: PLACE_DISCOVERY vs SAFETY_HEALTH

### T001 — translate-vi-zh

- Input: Xin chào, nhà vệ sinh ở đâu?
- Kết quả: FAIL
- Lỗi: required meaning 1: 洗手间 | 厕所 · 你好，; required meaning 2: 哪里 | 哪儿 · 你好，
- Bản dịch thực tế: 你好，

### T002 — translate-vi-zh

- Input: Chỉ đường giúp tôi đến Hồng Nhai Động.
- Kết quả: FAIL
- Lỗi: required meaning 1: 洪崖洞 · 请指路带我去
- Bản dịch thực tế: 请指路带我去

### T003 — translate-vi-zh

- Input: Đi bộ đến đó mất bao lâu?
- Kết quả: FAIL
- Lỗi: required meaning 1: 走路 | 步行 · 走去那里要多久？
- Bản dịch thực tế: 走去那里要多久？

### T005 — translate-vi-zh

- Input: Tôi bị dị ứng đậu phộng.
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"zh-Hans","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T006 — translate-vi-zh

- Input: Làm ơn gọi giúp tôi một chiếc taxi.
- Kết quả: FAIL
- Lỗi: required meaning 1: 出租车 | 的士 · 请帮我叫
- Bản dịch thực tế: 请帮我叫

### T007 — translate-vi-zh

- Input: Món này giá bao nhiêu?
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"zh-Hans","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T009 — translate-vi-zh

- Input: Tôi muốn nhận phòng khách sạn.
- Kết quả: FAIL
- Lỗi: required meaning 2: 入住 | 登记 · 我想办理酒店
- Bản dịch thực tế: 我想办理酒店

### T010 — translate-vi-zh

- Input: Chuyến tàu điện cuối cùng lúc mấy giờ?
- Kết quả: FAIL
- Lỗi: required meaning 2: 地铁 · 最后一班电车; required meaning 3: 几点 · 最后一班电车
- Bản dịch thực tế: 最后一班电车

### T011 — translate-vi-zh

- Input: Tôi không ăn cay.
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"zh-Hans","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T012 — translate-vi-zh

- Input: Cho tôi một vé đến ga Trùng Khánh Bắc.
- Kết quả: FAIL
- Lỗi: required meaning 1: 重庆北站 · 给我一张去
- Bản dịch thực tế: 给我一张去

### T013 — translate-vi-zh

- Input: Tôi cần có mặt lúc 8 giờ sáng.
- Kết quả: FAIL
- Lỗi: required meaning 1: 八点 | 8点 · 我需要在早上
- Bản dịch thực tế: 我需要在早上

### T014 — translate-vi-zh

- Input: Tổng cộng là 120 nhân dân tệ đúng không?
- Kết quả: FAIL
- Lỗi: translation similarity: 30% · 总共是120元人民币,
- Bản dịch thực tế: 总共是120元人民币,

### T015 — translate-vi-zh

- Input: Khách sạn Yitel nằm ở đường nào?
- Kết quả: FAIL
- Lỗi: translation similarity: 25% · Oitel 酒店; required meaning 1: 和颐 | Yitel · Oitel 酒店; required meaning 2: 路 · Oitel 酒店
- Bản dịch thực tế: Oitel 酒店

### T016 — translate-vi-zh

- Input: Tôi làm mất hộ chiếu.
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"zh-Hans","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T018 — translate-vi-zh

- Input: Tôi có hai vali và một ba lô.
- Kết quả: FAIL
- Lỗi: required meaning 3: 背包 · 我有两个行李箱
- Bản dịch thực tế: 我有两个行李箱

### T019 — translate-vi-zh

- Input: Xe buýt này có đến sân bay không?
- Kết quả: FAIL
- Lỗi: required meaning 2: 机场 · 这辆公交车
- Bản dịch thực tế: 这辆公交车

### T021 — translate-vi-zh

- Input: Trời đang mưa, tôi cần mua ô.
- Kết quả: FAIL
- Lỗi: required meaning 2: 伞 · 外面在下雨，
- Bản dịch thực tế: 外面在下雨，

### T022 — translate-vi-zh

- Input: Xin dừng ở cổng số 2.
- Kết quả: FAIL
- Lỗi: required meaning 1: 二号门 | 2号门 · 请在二号; required meaning 2: 停车 | 停 · 请在二号
- Bản dịch thực tế: 请在二号

### T023 — translate-vi-zh

- Input: Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.
- Kết quả: FAIL
- Lỗi: required meaning 1: 解放碑 · 我想在7点前去解放; required meaning 3: 晚上 · 我想在7点前去解放
- Bản dịch thực tế: 我想在7点前去解放

### T024 — translate-vi-zh

- Input: Có cửa hàng tiện lợi nào mở 24 giờ không?
- Kết quả: FAIL
- Lỗi: required meaning 1: 二十四小时 | 24小时 · 有哪家便利店是24
- Bản dịch thực tế: 有哪家便利店是24

### T025 — translate-vi-zh

- Input: Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.
- Kết quả: FAIL
- Lỗi: required meaning 1: 临江支路 · 酒店地址是林江路; required meaning 2: 三十号 | 30号 · 酒店地址是林江路
- Bản dịch thực tế: 酒店地址是林江路

### T027 — translate-zh-vi

- Input: 请带我去洪崖洞。
- Kết quả: FAIL
- Lỗi: required meaning 1: hồng nhai động | hongya · Làm ơn đưa tôi đến
- Bản dịch thực tế: Làm ơn đưa tôi đến

### T028 — translate-zh-vi

- Input: 走路到那里需要多长时间？
- Kết quả: FAIL
- Lỗi: transcript fidelity: 50% · 走陸道那裡需要多長; required meaning 1: đi bộ · Đi đường bộ thì mất; required meaning 2: bao lâu | mất bao nhiêu thời gian · Đi đường bộ thì mất
- Bản dịch thực tế: Đi đường bộ thì mất

### T030 — translate-zh-vi

- Input: 我对花生过敏。
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"vi","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T031 — translate-zh-vi

- Input: 请帮我叫一辆出租车。
- Kết quả: FAIL
- Lỗi: required meaning 1: taxi | xe taxi · Làm ơn gọi giúp tôi
- Bản dịch thực tế: Làm ơn gọi giúp tôi

### T032 — translate-zh-vi

- Input: 这个多少钱？
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"vi","sourceText":"","translatedText":"","audioBytes":0,"complete":false}

### T033 — translate-zh-vi

- Input: 这里可以用支付宝付款吗？
- Kết quả: FAIL
- Lỗi: required meaning 1: alipay | chi phó bảo · Ở đây có thể dùng; required meaning 2: thanh toán · Ở đây có thể dùng
- Bản dịch thực tế: Ở đây có thể dùng

### T034 — translate-zh-vi

- Input: 我想办理酒店入住。
- Kết quả: INFRA
- Lỗi: LIVE_TRANSLATION_TIMEOUT:{"target":"vi","sourceText":"我想办理酒店入住,","translatedText":"Tôi muốn làm thủ tục nhận","audioBytes":72000,"complete":false}

### T035 — translate-zh-vi

- Input: 最后一班地铁是几点？
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T036 — translate-zh-vi

- Input: 我不吃辣。
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T037 — translate-zh-vi

- Input: 请给我一张去重庆北站的票。
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T038 — translate-zh-vi

- Input: 我早上八点需要到达。
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T039 — translate-zh-vi

- Input: 一共是一百二十元，对吗？
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T040 — translate-zh-vi

- Input: 和颐酒店在哪条路上？
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T041 — translate-zh-vi

- Input: 我的护照丢了。
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T042 — translate-zh-vi

- Input: 请带我去最近的派出所。
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T043 — translate-zh-vi

- Input: 我有两个行李箱和一个背包。
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T044 — translate-zh-vi

- Input: 这辆公交车去机场吗？
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T045 — translate-zh-vi

- Input: 博物馆几点关门？
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T046 — translate-zh-vi

- Input: 正在下雨，我需要买一把伞。
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T047 — translate-zh-vi

- Input: 请在二号门停车。
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T048 — translate-zh-vi

- Input: 我想在晚上七点前到达解放碑。
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR

### T049 — translate-zh-vi

- Input: 有二十四小时营业的便利店吗？
- Kết quả: INFRA
- Lỗi: LIVE_SETUP_TIMEOUT

### T050 — translate-zh-vi

- Input: 酒店地址是临江支路三十号。
- Kết quả: INFRA
- Lỗi: LIVE_SOCKET_ERROR
