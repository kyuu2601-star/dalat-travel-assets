# TravelOS live eval

- Thời điểm: 2026-11-07T05:28:37.052Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **97.5%**
- Critical failures: **L24, L25, L26**
- Infra errors: **0**
- p95 latency: **8515 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 6707 ms | — |
| L02 | PASS | Có | 6126 ms | — |
| L03 | PASS | Có | 3235 ms | — |
| L04 | PASS | Có | 109 ms | — |
| L05 | PASS | Có | 120 ms | — |
| L06 | PASS | Có | 352 ms | — |
| L07 | PASS | Có | 3309 ms | — |
| L08 | PASS | Có | 2347 ms | — |
| L09 | PASS | Không | 360 ms | — |
| L10 | PASS | Không | 3671 ms | — |
| L11 | PASS | Có | 7945 ms | — |
| L12 | PASS | Có | 155 ms | — |
| L13 | PASS | Có | 132 ms | — |
| L14 | PASS | Có | 6173 ms | — |
| L15 | PASS | Có | 475 ms | — |
| L16 | PASS | Không | 4543 ms | — |
| L17 | PASS | Không | 4743 ms | — |
| L18 | PASS | Không | 4883 ms | — |
| L19 | PASS | Có | 4875 ms | — |
| L20 | PASS | Có | 6910 ms | — |
| L21 | PASS | Có | 7260 ms | — |
| L22 | PASS | Không | 2772 ms | — |
| L23 | PASS | Không | 8515 ms | — |
| L24 | FAIL | Có | 5850 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH; router GPS policy: false vs true |
| L25 | FAIL | Có | 4990 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH |
| L26 | FAIL | Có | 3338 ms | router GPS policy: false vs true |
| L27 | PASS | Không | 3319 ms | — |
| L28 | PASS | Không | 13612 ms | — |
| L29 | PASS | Không | 4227 ms | — |
| L30 | PASS | Không | 139 ms | — |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Chào bạn, Pipi gửi bạn danh sách các cửa hàng tiện lợi ở quanh đây nhé: 1. **Circle K Lý Tự Trọng** - Địa chỉ: 45 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh - Khoảng cách: Khoảng 232m 2. **7-Eleven** - Địa chỉ: 81 Nguyễn Du, Sài Gòn, Hồ Chí Minh - Khoảng cách: Khoảng 238m 3. **Circle K Nguyễn Huệ** - Địa chỉ: 82 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh - Khoảng cách: Khoảng 284m 4. **Circle K** - Địa chỉ: 42 Lê Lợi, Sài Gòn, Hồ Chí Minh - Khoảng cách: Khoảng 308m 5. **GS25 Hai Bà Trưng** - Địa chỉ: 62 Đường Hai Bà Trưng, Quận 1, Hồ Chí Minh - Khoảng cách: Khoảng 383m 6. **Circle K** - Địa chỉ: 54 Đ. Tôn Thất Thiệp, Sài Gòn, Hồ Chí Minh - Khoảng cách: Khoảng 393m 7. **Circle K Việt Nam** - Địa chỉ: 165, 167

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Chi nhánh Zaozilan Ya, Quận Du Trung) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Vạn Hòa (Nhân Hòa) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn b

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Mưa phùn dày, 23°C. Nhìn 8 giờ tới (16–22°C), thời tiết **không thật sự tiện để đi chơi ngoài trời**. Nếu vẫn đi, bạn nên ưu tiên điểm trong nhà, mang ô/áo mưa và chừa thời gian di chuyển.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi thông tin chi tiết về tuyến đường đi bộ từ vị trí hiện tại đến Dinh Độc Lập cho bạn nhé: - **Phương tiện:** Đi bộ - **Quãng đường:** 971 mét - **Thời gian di chuyển ước tính:** Khoảng 14 phút - **Tình trạng giao thông / Lưu ý:** Tuyến đường có một số đoạn bị giới hạn sử dụng hoặc là đường riêng. - **Chi tiết đường đi:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi. 2. Rẽ trái vào đường Đồng Khởi. 3. Rẽ trái vào đường Nguyễn Du. 4. Rẽ phải tại khu vực phòng vé Dinh Độc Lập. 5. Tiếp tục rẽ trái rồi rẽ phải tại cửa hàng lưu niệm Dinh Design Store để tới điểm đến ở bên trái. - **Điểm đến:** Dinh Độc Lập (Bến Thành, TP.HCM).

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. TSURUHA DRUG STORE Ly Tu Trong Shop — ⭐ 4.3 (61 đánh giá) · 237 m · 43 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 710000, Việt Nam. - 3. Nhà thuốc Pharmacity — ⭐ 3.9 (254 đánh giá) · 349 m · 97 Hai Bà Trưng, Quận 1, Hồ Chí Minh 71000, Việt Nam. - 4. Nhà Thuốc Tư Nhân Bến Nghé — ⭐ 3.3 (4 đánh giá) · 352 m · 124 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 5. Công Ty TNHH Nhà Thuốc Tốt — ⭐ 4.7 (16 đánh giá) · 354 m · Lầu 9, 68 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. Bạn bấm vào danh sách/b

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi gợi ý cho bạn lịch trình một ngày khám phá Đà Lạt được sắp xếp theo các cụm địa điểm gần nhau, nhẹ nhàng và không quá dày đặc để bạn thoải mái tận hưởng nhé: **Buổi sáng: Thưởng thức bánh ngọt và cà phê ngắm cảnh** * **09:00 - 10:30 | Canelés Dalat – since 2020:** Ghé tiệm để thưởng thức những chiếc bánh Canelé vỏ giòn ruột mềm nổi tiếng (bạn lưu ý đường lên dốc khá cao và hẹp nên có thể đi bộ từ đầu hẻm vào nhé). * **10:30 - 12:00 | Kem bơ Phụng chợ Đà Lạt:** Di chuyển ra khu vực gần đó để thưởng thức món kem bơ đặc sản trứ danh của thành phố. **Buổi trưa & Chiều: Trải nghiệm không gian và mua sắm đặc sản** * **12:00 - 14:00 | Émai Dallat Coffee:** Nghỉ ngơi và dùng bữa trưa

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Khách sạn Yitel (Trùng Khánh Nam Bình Vạn Đạt Quảng Trường) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186 đường Huệ Công, quận Nam Ngạn (南坪惠工路186号) 3. Khách sạn Yitel (Trùng Khánh Song Bi) (和颐酒店(重庆双碑轻轨站店)) — Số 34-10 đường Song Bi, quận Sa Bình Bá (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh khác. Nếu chưa đúng, bạn gửi link bản đồ hoặc mô tả nó gần đâu nhé. Pipi sẽ tìm chỗ ăn chơi sau khi xác / Pipi đã lấy Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệt sĩ Trương Bồi Tước (张培爵烈士纪念碑

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
