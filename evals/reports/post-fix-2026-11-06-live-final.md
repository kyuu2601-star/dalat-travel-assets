# TravelOS live eval

- Thời điểm: 2026-11-06T03:31:28.456Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **100%**
- Critical failures: **0**
- Infra errors: **0**
- p95 latency: **16011 ms**
- Gate: **PASS**
- Manual review: **PASS**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 5673 ms | — |
| L02 | PASS | Có | 8797 ms | — |
| L03 | PASS | Có | 3475 ms | — |
| L04 | PASS | Có | 140 ms | — |
| L05 | PASS | Có | 97 ms | — |
| L06 | PASS | Có | 119 ms | — |
| L07 | PASS | Có | 3785 ms | — |
| L08 | PASS | Có | 2935 ms | — |
| L09 | PASS | Không | 138 ms | — |
| L10 | PASS | Không | 5040 ms | — |
| L11 | PASS | Có | 16011 ms | — |
| L12 | PASS | Có | 127 ms | — |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [x] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Pipi gửi bạn danh sách các cửa hàng tiện lợi ở gần bạn nè: 1. **Circle K Lý Tự Trọng** - Khoảng cách: khoảng 232 mét - Địa chỉ: 45 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 2. **7-Eleven** - Khoảng cách: khoảng 238 mét - Địa chỉ: 81 Nguyễn Du, Sài Gòn, Hồ Chí Minh 3. **Circle K Nguyễn Du** - Khoảng cách: khoảng 268 mét - Địa chỉ: 57 Nguyễn Du, Quận 1, Hồ Chí Minh 4. **Circle K Nguyễn Huệ** - Khoảng cách: khoảng 284 mét - Địa chỉ: 82 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 5. **Lê Loi Alley Convenience Store** - Khoảng cách: khoảng 293 mét - Địa chỉ: 36 Lê Lợi, Sài Gòn, Hồ Chí Minh 6. **Circle K** - Khoảng cách: khoảng 308 mét - Địa chỉ: 42 Lê Lợi, Sài Gòn, Hồ Chí Minh 7. **GS25 Hai Bà Trưng** - Khoảng cách

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [x] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Chi nhánh Zaozilan Ya, quận Yuzhong) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Vạn Hòa (Nhân Hòa) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Huafuxiang Kepi) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào danh sách/bản đồ bê

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [x] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Có mây rải rác, 25°C, cảm giác như 27°C. Nhìn 8 giờ tới (18–25°C), thời tiết **không thật sự tiện để đi chơi ngoài trời**. Nếu vẫn đi, bạn nên ưu tiên điểm trong nhà, mang ô/áo mưa và chừa thời gian di chuyển.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [x] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi thông tin chi tiết về tuyến đường đi bộ từ vị trí hiện tại đến Dinh Độc Lập cho bạn nhé: - **Phương tiện:** Đi bộ - **Khoảng cách:** 969 mét - **Thời gian di chuyển:** Khoảng 13 phút (808 giây) - **Tình trạng giao thông:** Tuyến đường có một số đoạn bị giới hạn sử dụng hoặc là đường riêng. - **Chi tiết đường đi:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi, đi qua Ceci Cela - Vincom Đồng Khởi (khoảng 51m). 2. Rẽ trái tại Cyber Real - Văn Phòng Cho Thuê TPHCM vào Đồng Khởi, đi qua Gánh Mưu Sinh (khoảng 243m). 3. Rẽ trái tại Nhà trọ Nhân Nghĩa vào Nguyễn Du, đi qua Tòa nhà President Place Tower (khoảng 386m). 4. Rẽ phải tại khu vực bán vé của Dinh Độc Lập (khoảng 196m). 5

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [x] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. TSURUHA DRUG STORE Ly Tu Trong Shop — ⭐ 4.3 (61 đánh giá) · 237 m · 43 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 710000, Việt Nam. - 3. Nhà thuốc Pharmacity — ⭐ 3.9 (254 đánh giá) · 349 m · 97 Hai Bà Trưng, Quận 1, Hồ Chí Minh 71000, Việt Nam. - 4. Nhà Thuốc Tư Nhân Bến Nghé — ⭐ 3.3 (4 đánh giá) · 352 m · 124 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 5. Công Ty TNHH Nhà Thuốc Tốt — ⭐ 4.7 (16 đánh giá) · 354 m · Lầu 9, 68 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. Bạn bấm vào danh sách/b

### L10 — Lịch trình một ngày lấy điểm từ D1
- [x] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [x] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi gửi bạn gợi ý lịch trình tham quan Đà Lạt trong 1 ngày được sắp xếp theo các cụm gần nhau, nhẹ nhàng và không quá dày đặc để bạn thoải mái trải nghiệm nhé: **Buổi sáng: Khám phá khu vực trung tâm và thưởng thức quà vặt** - **08:30 - 10:00:** Ghé **Cala Lily Dalat ** (08:00 - 18:00) để dạo vườn rộng, ngắm ao cá, chơi cùng thú cưng và thưởng thức cold brew hoặc bánh ngọt. - **10:00 - 11:30:** Di chuyển sang **Canelés Dalat – since 2020** (09:00 - 19:00) để ghé mua bánh canelé giòn thơm nổi tiếng (bạn lưu ý đoạn này có dốc nhỏ nên có thể đi bộ từ đầu hẻm vào nhé). - **11:30 - 13:00:** Dùng bữa trưa tại **Émai Dallat Coffee** (07:30 - 22:00) với các món mì Ý handmade hoặc set menu

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [x] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Khách sạn Yitel (Trùng Khánh Nam Bình Vạn Đạt Quảng Trường) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186 đường Huệ Công, quận Nam Ngạn (南坪惠工路186号) 3. Khách sạn Yitel (Trùng Khánh Song Bi) (和颐酒店(重庆双碑轻轨站店)) — Số 34, phụ 10-1 đường Song Bi, quận Sa Bình Bá (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh khác. Nếu chưa đúng, bạn gửi link bản đồ hoặc mô tả nó gần đâu nhé. Pipi sẽ tìm chỗ ăn chơi sau  / Pipi đã lấy Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệt sĩ Trương Bồi Tước (张培爵烈士纪念碑

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [x] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
