# TravelOS live eval

- Thời điểm: 2026-11-06T18:44:11.128Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **100%**
- Critical failures: **0**
- Infra errors: **0**
- p95 latency: **47881 ms**
- Gate: **PASS**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 11924 ms | — |
| L02 | PASS | Có | 11931 ms | — |
| L03 | PASS | Có | 3720 ms | — |
| L04 | PASS | Có | 105 ms | — |
| L05 | PASS | Có | 82 ms | — |
| L06 | PASS | Có | 97 ms | — |
| L07 | PASS | Có | 19450 ms | — |
| L08 | PASS | Có | 9345 ms | — |
| L09 | PASS | Không | 123 ms | — |
| L10 | PASS | Không | 6895 ms | — |
| L11 | PASS | Có | 47881 ms | — |
| L12 | PASS | Có | 82 ms | — |
| L13 | PASS | Có | 92 ms | — |
| L14 | PASS | Có | 16597 ms | — |
| L15 | PASS | Có | 87 ms | — |
| L16 | PASS | Không | 8310 ms | — |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Chào bạn, Pipi gửi bạn danh sách các cửa hàng tiện lợi ở quanh đây nhé: 1. **Circle K Lý Tự Trọng** - **Khoảng cách:** Khoảng 232m - **Địa chỉ:** 45 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 2. **7-Eleven** - **Khoảng cách:** Khoảng 238m - **Địa chỉ:** 81 Nguyễn Du, Sài Gòn, Hồ Chí Minh 3. **Circle K Nguyễn Du** - **Khoảng cách:** Khoảng 268m - **Địa chỉ:** 57 Nguyễn Du, Quận 1, Hồ Chí Minh 4. **Circle K Nguyễn Huệ** - **Khoảng cách:** Khoảng 284m - **Địa chỉ:** 82 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 5. **Circle K** - **Khoảng cách:** Khoảng 308m - **Địa chỉ:** 42 Lê Lợi, Sài Gòn, Hồ Chí Minh 6. **GS25 Hai Bà Trưng** - **Khoảng cách:** Khoảng 383m - **Địa chỉ:** 62 Đường Hai Bà Trưng, Quận 1, Hồ Chí Mi

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Zaozilan Ya) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Wanhe Pharmacy (Renhe Street) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào danh sá

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Trời quang, 15°C. Nhìn 8 giờ tới (15–24°C), thời tiết **khá tiện để đi chơi**. Bạn có thể đi ngoài trời; mang nước và kiểm tra lại radar mưa trước lúc rời chỗ ở.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi sẽ hướng dẫn bạn cách đi bộ từ vị trí hiện tại đến Dinh Độc Lập như sau: * **Khoảng cách:** 971 mét. * **Thời gian di chuyển dự kiến:** Khoảng 13-14 phút (dựa trên dữ liệu quãng đường 809 giây). * **Chi tiết lộ trình:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi. 2. Rẽ trái tại Cyber Real - Văn Phòng Cho Thuê TPHCM vào đường Đồng Khởi. 3. Rẽ trái tại Nhà trọ Nhân Nghĩa vào đường Nguyễn Du. 4. Rẽ phải tại Ticket office of the independence palace. 5. Rẽ trái. 6. Rẽ phải tại Dinh Design Store - Independence Palace Souvenir Shop, điểm đến sẽ nằm ở phía bên trái của bạn. *Lưu ý: Một số đoạn trên tuyến đường này có giới hạn sử dụng hoặc là đường riêng, bạn vui lòng quan sát biển báo

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. TSURUHA DRUG STORE Ly Tu Trong Shop — ⭐ 4.3 (61 đánh giá) · 237 m · 43 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 710000, Việt Nam. - 3. Nhà thuốc Pharmacity — ⭐ 3.9 (254 đánh giá) · 349 m · 97 Hai Bà Trưng, Quận 1, Hồ Chí Minh 71000, Việt Nam. - 4. Nhà Thuốc Tư Nhân Bến Nghé — ⭐ 3.3 (4 đánh giá) · 352 m · 124 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 5. Công Ty TNHH Nhà Thuốc Tốt — ⭐ 4.7 (16 đánh giá) · 354 m · Lầu 9, 68 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. Bạn bấm vào danh sách/b

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi gửi bạn gợi ý lịch trình 1 ngày tại Đà Lạt được sắp xếp các điểm gần nhau, không quá dày đặc để bạn thoải mái trải nghiệm nhé: **Buổi sáng (09:00 - 11:30): Khám phá khu vực trung tâm và thưởng thức quà vặt** * **09:00 - 10:00:** Ghé **Kem bơ Phụng chợ Đà Lạt** (Mở cửa: 09:00 - 22:30) để thưởng thức món kem bơ trứ danh. * **10:00 - 11:30:** Di chuyển gần đó đến **Canelés Dalat – since 2020** (Mở cửa: 09:00 - 19:00) để mua bánh canelé giòn thơm (lưu ý đoạn đường lên tiệm dốc khá cao và hẹp). **Buổi trưa và chiều (11:30 - 16:30): Thư giãn và ngắm cảnh thung lũng** * **11:30 - 13:30:** Nghỉ ngơi và dùng bữa trưa kiểu Ý tại **Émai Dallat Coffee** (Mở cửa: 07:30 - 22:00). * **13:30

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Khách sạn Yitel (Trùng Khánh Nam Bình - Quảng trường Vạn Đạt) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186 đường Huệ Công, quận Nam Ngạn (南坪惠工路186号) 3. Khách sạn Yitel (Trùng Khánh - Ga tàu điện nhẹ Song Bi) (和颐酒店(重庆双碑轻轨站店)) — Số 34, phụ số 10-1 đường Song Bi, quận Sa Bình Bá (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh khác. Nếu chưa đúng, bạn gửi link bản đồ hoặc mô tả nó gần đâu nhé. Pipi  / Pipi đã lấy Khách sạn Yitel Premium (Trùng Khánh Giải Phóng Bi - Hồng Nhai Động) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30 đường Lâm Giang Chi, quận Du Trung (cách cửa số 1 ga tàu điện ngầm Lâm Giang Môn 450 mét) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệt sĩ Trương Bồi Tước (张培爵烈士纪念碑) — 8

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
