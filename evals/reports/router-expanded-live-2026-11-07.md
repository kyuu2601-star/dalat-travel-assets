# TravelOS live eval

- Thời điểm: 2026-11-06T19:20:15.336Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **93.4%**
- Critical failures: **L24, L25, L26**
- Infra errors: **0**
- p95 latency: **15320 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 15320 ms | — |
| L02 | PASS | Có | 15100 ms | — |
| L03 | PASS | Có | 3829 ms | — |
| L04 | PASS | Có | 120 ms | — |
| L05 | PASS | Có | 114 ms | — |
| L06 | PASS | Có | 108 ms | — |
| L07 | PASS | Có | 5292 ms | — |
| L08 | PASS | Có | 9132 ms | — |
| L09 | PASS | Không | 120 ms | — |
| L10 | PASS | Không | 13604 ms | — |
| L11 | PASS | Có | 20043 ms | — |
| L12 | PASS | Có | 92 ms | — |
| L13 | PASS | Có | 102 ms | — |
| L14 | PASS | Có | 4514 ms | — |
| L15 | PASS | Có | 95 ms | — |
| L16 | PASS | Không | 7775 ms | — |
| L17 | FAIL | Không | 5955 ms | router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY |
| L18 | FAIL | Không | 4029 ms | router intent: WEATHER_OUTDOOR vs PLACE_DISCOVERY |
| L19 | PASS | Có | 6308 ms | — |
| L20 | PASS | Có | 3805 ms | — |
| L21 | PASS | Có | 7424 ms | — |
| L22 | FAIL | Không | 11401 ms | router intent: PLACE_DISCOVERY vs WEATHER_OUTDOOR |
| L23 | FAIL | Không | 3477 ms | router GPS policy: true vs false |
| L24 | FAIL | Có | 10343 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router GPS policy: false vs true |
| L25 | FAIL | Có | 9216 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router intent: PLACE_DISCOVERY vs SAFETY_HEALTH |
| L26 | FAIL | Có | 11467 ms | router GPS policy: false vs true |
| L27 | FAIL | Không | 11170 ms | router decision: MODEL_ANSWER vs PLANNER_MODEL; router intent: TRAVEL_UTILITY vs ITINERARY_PLANNING; router agreement: false vs true; actual PLANNER_MODEL |
| L28 | PASS | Không | 4086 ms | — |
| L29 | FAIL | Không | 4198 ms | router decision: API_TOOLS vs PLANNER_MODEL; router intent: WEATHER_OUTDOOR vs ITINERARY_PLANNING; router GPS policy: true vs false; router agreement: false vs true; actual PLANNER_MODEL |
| L30 | FAIL | Không | 106 ms | router decision: MODEL_ANSWER vs GUIDED_CHAT; router intent: TRAVEL_UTILITY vs LOCAL_GUIDE; router agreement: false vs true; actual GUIDED_CHAT |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Chào bạn, Pipi gửi bạn danh sách các cửa hàng tiện lợi ở gần vị trí của bạn nhé: 1. **Circle K** - Khoảng cách: ~234m - Địa chỉ: Đường Lý Tự Trọng, Phường Sài Gòn, Thành phố Hồ Chí Minh - Giờ mở cửa: 24/7 2. **7-Eleven** - Khoảng cách: ~243m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 3. **7-Eleven** - Khoảng cách: ~251m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 4. **Shop&Go!** - Khoảng cách: ~262m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 5. **Circle K** - Khoảng cách: ~264m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 6. **Circle K** - Khoảng cách: ~290m - Địa chỉ: Đường Nguyễn Huệ, Phường Sài Gòn,

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Zaozilan Ya) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Vạn Hòa (Nhân Hòa) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào danh sách/bản đồ b

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Có mây rải rác, 16°C. Nhìn 8 giờ tới (16–24°C), thời tiết **khá tiện để đi chơi**. Bạn có thể đi ngoài trời; mang nước và kiểm tra lại radar mưa trước lúc rời chỗ ở.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi thông tin chi tiết về tuyến đường đi bộ đến Dinh Độc Lập cho bạn nhé: - **Phương tiện:** Đi bộ - **Quãng đường:** 959 mét - **Thời gian di chuyển ước tính:** Khoảng 13 phút (800 giây) - **Chi tiết tuyến đường:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi (51 mét). 2. Rẽ trái tại Cyber Real - Văn Phòng Cho Thuê TPHCM vào Đồng Khởi (243 mét). 3. Rẽ trái tại Nhà trọ Nhân Nghĩa vào Nguyễn Du (386 mét). 4. Rẽ phải tại Ticket office of the independence palace (196 mét). 5. Rẽ trái (32 mét). 6. Rẽ phải tại Dinh Design Store - Independence Palace Souvenir Shop để tới Dinh Độc Lập ở bên phải (52 mét). - **Điểm đến:** Dinh Độc Lập (135, Đường Nam Kỳ Khởi Nghĩa, Phường Bến Thành,

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. Nhà thuốc Pharmacity — ⭐ 3.9 (254 đánh giá) · 349 m · 97 Hai Bà Trưng, Quận 1, Hồ Chí Minh 71000, Việt Nam. - 3. Nhà Thuốc Tư Nhân Bến Nghé — ⭐ 3.3 (4 đánh giá) · 352 m · 124 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 4. Công Ty TNHH Nhà Thuốc Tốt — ⭐ 4.7 (16 đánh giá) · 354 m · Lầu 9, 68 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. - 5. Công Ty Tnhh Quốc Tế Khánh Linh - Nhà Thuốc Khánh Linh 1 — 378 m · 64 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. Bạn bấm vào danh sách/b

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi xin gợi ý lịch trình một ngày khám phá Đà Lạt thật nhẹ nhàng, thoải mái và ưu tiên các điểm gần khu vực trung tâm để bạn không phải di chuyển quá nhiều: **Buổi sáng: Thưởng thức bánh ngọt và cà phê thư thái** - **09:00 - 10:30:** Ghé tiệm **Canelés Dalat – since 2020** (tọa lạc trên đường có dốc nhỏ, bạn có thể đi bộ đoạn ngắn từ đầu hẻm) để thưởng thức các loại bánh canelé giòn thơm, đậm vị. - **10:30 - 12:00:** Di chuyển sang **Cala Lily Dalat** để tận hưởng không gian rộng rãi, ngắm ao cá, chơi đùa cùng thú cưng và nhâm nhi một ly cold brew hoặc bánh ngọt handmade. **Buổi trưa & Chiều: Ăn trưa và ghé chợ Đà Lạt** - **12:00 - 13:30:** Bạn có thể chọn thưởng thức món Ý chỉn c

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Yitel Premium Hotel (Chí Hòa Chí Thượng Tửu Điếm - Trùng Khánh Giải Phóng Bi Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30 đường nhánh Lâm Giang (cách lối ra số 1 ga tàu điện ngầm Lâm Giang Môn đi bộ 450m) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Yitel Hotel (Hòa Y Tửu Điếm - Trùng Khánh Nam Bình Vạn Đạt Quảng Trường Khinh Quỹ Trạm Điếm) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186 đường Huệ Công, Nam Bình (南坪惠工路186号) 3. Yitel Hotel (Hòa Y Tửu Điếm - Trùng Khánh Song Bi Khinh Quỹ Trạm Điếm) (和颐酒店(重庆双碑轻轨站店)) — Số 34, ngách 10, số nhà 1, phố Song Bi (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh khác. Nếu chưa đúng, bạn g / Pipi đã lấy Yitel Premium Hotel (Chí Hòa Chí Thượng Tửu Điếm - Trùng Khánh Giải Phóng Bi Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30 đường nhánh Lâm Giang (cách lối ra số 1 ga tàu điện ngầm Lâm Giang Môn đi bộ 450m) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệt sĩ Trương B

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
