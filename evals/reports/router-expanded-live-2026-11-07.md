# TravelOS live eval

- Thời điểm: 2026-11-06T19:01:35.066Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **89.7%**
- Critical failures: **L19, L20, L21, L24, L25, L26**
- Infra errors: **0**
- p95 latency: **14310 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 8723 ms | — |
| L02 | PASS | Có | 7359 ms | — |
| L03 | PASS | Có | 3559 ms | — |
| L04 | PASS | Có | 97 ms | — |
| L05 | PASS | Có | 114 ms | — |
| L06 | PASS | Có | 106 ms | — |
| L07 | PASS | Có | 8383 ms | — |
| L08 | PASS | Có | 12008 ms | — |
| L09 | PASS | Không | 118 ms | — |
| L10 | PASS | Không | 4493 ms | — |
| L11 | PASS | Có | 19168 ms | — |
| L12 | PASS | Có | 93 ms | — |
| L13 | PASS | Có | 110 ms | — |
| L14 | PASS | Có | 14310 ms | — |
| L15 | PASS | Có | 108 ms | — |
| L16 | PASS | Không | 7878 ms | — |
| L17 | FAIL | Không | 5846 ms | router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY |
| L18 | FAIL | Không | 8695 ms | router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY |
| L19 | FAIL | Có | 2654 ms | route returned: 0 routes |
| L20 | FAIL | Có | 2977 ms | route returned: 0 routes |
| L21 | FAIL | Có | 2940 ms | router decision: MODEL_ANSWER vs API_TOOLS; router intent: TRAVEL_UTILITY vs ROUTE_MOBILITY; router agreement: false vs true; actual API_TOOLS; route returned: 0 routes |
| L22 | FAIL | Không | 3065 ms | router intent: PLACE_DISCOVERY vs WEATHER_OUTDOOR |
| L23 | FAIL | Không | 4670 ms | router GPS policy: true vs false |
| L24 | FAIL | Có | 6113 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router GPS policy: false vs true |
| L25 | FAIL | Có | 7730 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router intent: PLACE_DISCOVERY vs SAFETY_HEALTH |
| L26 | FAIL | Có | 3850 ms | router GPS policy: false vs true |
| L27 | FAIL | Không | 2652 ms | router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; router agreement: false vs true; actual PLANNER_MODEL |
| L28 | PASS | Không | 2459 ms | — |
| L29 | FAIL | Không | 4914 ms | router decision: API_TOOLS vs PLANNER_MODEL; router intent: WEATHER_OUTDOOR vs ITINERARY_PLANNING; router GPS policy: true vs false; router agreement: false vs true; actual PLANNER_MODEL |
| L30 | FAIL | Không | 132 ms | router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; router agreement: false vs true; actual GUIDED_CHAT |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Chào bạn, Pipi gửi bạn danh sách các cửa hàng tiện lợi ở quanh đây nhé: 1. **Circle K** - Khoảng cách: Khoảng 234m - Địa chỉ: Đường Lý Tự Trọng, Phường Sài Gòn, Thành phố Hồ Chí Minh 2. **7-Eleven** - Khoảng cách: Khoảng 243m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 3. **7-Eleven** - Khoảng cách: Khoảng 251m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 4. **Shop&Go!** - Khoảng cách: Khoảng 262m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 5. **Circle K** - Khoảng cách: Khoảng 264m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 6. **Circle K** - Khoảng cách: Khoảng 290m - Địa chỉ: Đường Nguyễn Huệ, Phường 

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Zaozilan Ya) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Vạn Hòa (Nhân Hòa) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào danh sách/bản đồ b

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Trời quang, 15°C. Nhìn 8 giờ tới (15–24°C), thời tiết **khá tiện để đi chơi**. Bạn có thể đi ngoài trời; mang nước và kiểm tra lại radar mưa trước lúc rời chỗ ở.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi thông tin hướng dẫn đi bộ đến Dinh Độc Lập cho bạn đây ạ: - **Phương tiện:** Đi bộ - **Quãng đường:** 959 mét - **Thời gian di chuyển ước tính:** Khoảng 13 phút (800 giây) - **Tình trạng giao thông / Lưu ý:** Tuyến đường này có đoạn bị giới hạn sử dụng hoặc là đường riêng. - **Chi tiết tuyến đường:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi (qua khu vực Ceci Cela - Vincom Đồng Khởi). 2. Rẽ trái vào đường Đồng Khởi. 3. Rẽ trái vào đường Nguyễn Du. 4. Rẽ phải tại khu vực bán vé của Dinh Độc Lập. 5. Tiếp tục rẽ trái rồi rẽ phải tại Dinh Design Store - Independence Palace Souvenir Shop để đến điểm đến bên phải. Điểm đến của bạn là Dinh Độc Lập (địa chỉ tham khảo tại 135 N

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. Nhà thuốc Pharmacity — ⭐ 3.9 (254 đánh giá) · 349 m · 97 Hai Bà Trưng, Quận 1, Hồ Chí Minh 71000, Việt Nam. - 3. Nhà Thuốc Tư Nhân Bến Nghé — ⭐ 3.3 (4 đánh giá) · 352 m · 124 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 4. Công Ty TNHH Nhà Thuốc Tốt — ⭐ 4.7 (16 đánh giá) · 354 m · Lầu 9, 68 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. - 5. Công Ty Tnhh Quốc Tế Khánh Linh - Nhà Thuốc Khánh Linh 1 — 378 m · 64 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. Bạn bấm vào danh sách/b

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi gửi bạn gợi ý lịch trình tham quan Đà Lạt trong 1 ngày được sắp xếp theo các cụm điểm gần nhau, hợp lý và không quá dày đặc để bạn thoải mái tận hưởng chuyến đi nhé: ### Gợi ý lịch trình tham quan Đà Lạt trong 1 ngày **Buổi sáng: Khám phá trung tâm và thưởng thức bánh ngọt, kem bơ** - **09:00 - 10:30:** Ghé **Canelés Dalat – since 2020** (Mở cửa: 9:00 - 19:00) để thưởng thức các món bánh canelé và matcha thơm ngon. *Lưu ý: Đường lên dốc khá cao và hẹp, bạn có thể đi bộ từ đầu hẻm để xếp hàng.* - **10:30 - 12:00:** Di chuyển sang **Kem bơ Phụng chợ Đà Lạt** (Mở cửa: 09:00 - 22:30) ngay khu vực trung tâm để thưởng thức món kem bơ đặc trưng nổi tiếng. **Buổi trưa & Chiều: Thư giã

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Khách sạn Yitel (Trùng Khánh Nam Bình - Quảng trường Vạn Đạt) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186 đường Huệ Công, quận Nam Ngạn (南坪惠工路186号) 3. Khách sạn Yitel (Trùng Khánh - Ga tàu điện nhẹ Song Bi) (和颐酒店(重庆双碑轻轨站店)) — Số 34 đường Song Bi, phụ số 10-1, quận Sa Bình Bá (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh khác. Nếu chưa đúng, bạn gửi link bản đồ hoặc mô tả nó gần đâu nhé. Pipi  / Pipi đã lấy Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệt sĩ Trương Bồi Tước (张培爵烈士纪念碑

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
