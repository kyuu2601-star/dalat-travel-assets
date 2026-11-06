# TravelOS live eval

- Thời điểm: 2026-11-06T03:27:44.806Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **98.5%**
- Critical failures: **L08**
- Infra errors: **0**
- p95 latency: **38444 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 6589 ms | — |
| L02 | PASS | Có | 38444 ms | — |
| L03 | PASS | Có | 4399 ms | — |
| L04 | PASS | Có | 114 ms | — |
| L05 | PASS | Có | 136 ms | — |
| L06 | PASS | Có | 106 ms | — |
| L07 | PASS | Có | 4023 ms | — |
| L08 | FAIL | Có | 4120 ms | all POIs match requested category: Cửa hàng thuốc sinh lý |
| L09 | PASS | Không | 164 ms | — |
| L10 | PASS | Không | 4292 ms | — |
| L11 | PASS | Có | 23706 ms | — |
| L12 | PASS | Có | 119 ms | — |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Chào bạn, Pipi gửi bạn danh sách các cửa hàng tiện lợi quanh đây nhé: 1. **Circle K Lý Tự Trọng** - **Khoảng cách:** Khoảng 232m - **Địa chỉ:** 45 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 2. **7-Eleven** - **Khoảng cách:** Khoảng 238m - **Địa chỉ:** 81 Nguyễn Du, Sài Gòn, Hồ Chí Minh 3. **Circle K Nguyễn Du** - **Khoảng cách:** Khoảng 268m - **Địa chỉ:** 57 Nguyễn Du, Quận 1, Hồ Chí Minh 4. **Circle K Nguyễn Huệ** - **Khoảng cách:** Khoảng 284m - **Địa chỉ:** 82 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh 5. **Lê Loi Alley Convenience Store** - **Khoảng cách:** Khoảng 293m - **Địa chỉ:** 36 Lê Lợi, Sài Gòn, Hồ Chí Minh 6. **Circle K** - **Khoảng cách:** Khoảng 308m - **Địa chỉ:** 42 Lê Lợi, Sài Gòn, Hồ Chí 

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaozilan Ya) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Zaozilan Ya) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Vạn Hòa (Nhân Hòa) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào danh sách/bản đồ b

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Có mây rải rác, 25°C, cảm giác như 27°C. Nhìn 8 giờ tới (18–25°C), thời tiết **không thật sự tiện để đi chơi ngoài trời**. Nếu vẫn đi, bạn nên ưu tiên điểm trong nhà, mang ô/áo mưa và chừa thời gian di chuyển.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi thông tin chi tiết về tuyến đường đi bộ đến Dinh Độc Lập cho bạn nhé: - **Phương tiện:** Đi bộ - **Quãng đường:** 969 mét - **Thời gian di chuyển ước tính:** Khoảng 13 phút (808 giây) - **Tình trạng giao thông / Lưu ý:** Tuyến đường có một số đoạn bị giới hạn sử dụng hoặc là đường riêng. - **Chi tiết tuyến đường:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi, đi qua khu vực gần Vincom Đồng Khởi khoảng 51 mét. 2. Rẽ trái vào đường Đồng Khởi, đi tiếp khoảng 243 mét. 3. Rẽ trái vào đường Nguyễn Du, đi tiếp khoảng 386 mét (đi qua tòa nhà President Place Tower). 4. Rẽ phải tại khu vực bán vé của Dinh Độc Lập, đi tiếp 196 mét. 5. Rẽ trái đi thêm 31 mét. 6. Rẽ phải tại cửa hàng

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Nhà thuốc Pasteur — ⭐ 3.9 (67 đánh giá) · 119 m · 156 Pasteur, Sài Gòn, Hồ Chí Minh, Việt Nam. - 2. thuocsi.vn - Sàn thương mại điện tử dành riêng cho nhà thuốc và phòng khám — ⭐ 4.2 (67 đánh giá) · 161 m · Tầng 8, Tòa nhà Vincom Center, Đồng Khởi/72 Lê Thánh Tôn, Sài Gòn, Hồ Chí Minh, Việt Nam. - 3. TSURUHA DRUG STORE Ly Tu Trong Shop — ⭐ 4.3 (61 đánh giá) · 237 m · 43 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 710000, Việt Nam. - 4. Cửa hàng thuốc sinh lý — 269 m · 22 đường 61, Sài Gòn, Hồ Chí Minh 700000, Việt Nam. - 5. Can Gio Pharmaceutical Joint Stock Co. — ⭐ 4.5 (2 đánh giá) · 305 m · Mond

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Chào bạn, Pipi gửi bạn gợi ý lịch trình 1 ngày tại Đà Lạt được sắp xếp theo các cụm địa điểm gần nhau, không quá dày đặc để bạn thong thả tham quan nhé: **Gợi ý lịch trình 1 ngày tại Đà Lạt** * **Sáng (09:00 - 11:30): Khám phá khu vực trung tâm thành phố** * **09:00:** Bạn ghé **Kem bơ Phụng chợ Đà Lạt** (mở cửa từ 09:00 - 22:30, giá 15k - 35k) để thưởng thức món kem bơ hoặc kem dừa trứ danh. * **10:00:** Di chuyển gần đó đến **Canelés Dalat – since 2020** (mở cửa từ 09:00 - 19:00, giá 20k - 360k) để ghé mua bánh ngọt canelé giòn thơm (lưu ý đường lên tiệm có dốc cao và hẹp, bạn có thể đi bộ từ đầu hẻm). * **11:00:** Ghé **Vị Dalat** (mở cửa từ 07:00 - 21:00, giá 50k - 300k) ở gần khu vực tr

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Yitel Premium Hotel (Khách sạn Hòa颐 Chí Thượng - Chi nhánh Giải Phóng Bi, Hồng Nhai Động, Trùng Khánh / 和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30, đường nhánh Lâm Giang (đi bộ 450m từ lối ra số 1 của ga tàu điện ngầm Lâm Giang Môn) (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Yitel Hotel (Khách sạn Hòa颐 - Chi nhánh Quảng trường Vạn Đạt Nam Bình, Ga đường sắt nhẹ, Trùng Khánh / 和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186, đường Huệ Công, Nam Bình (南坪惠工路186号) 3. Yitel Hotel (Khách sạn Hòa颐 - Chi nhánh Ga đường sắt nhẹ Songbei, Trùng Khánh / 和颐酒店(重庆双碑轻轨站店)) — Số 34, phố Songbei, phòng phụ 10-1 (双碑街34号附10号-1) Bạn có thể trả lời “đúng số 2” nếu là chi nhánh / Pipi đã lấy Yitel Premium Hotel (Khách sạn Hòa颐 Chí Thượng - Chi nhánh Giải Phóng Bi, Hồng Nhai Động, Trùng Khánh / 和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30, đường nhánh Lâm Giang (đi bộ 450m từ lối ra số 1 của ga tàu điện ngầm Lâm Giang Môn) (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đài tưởng niệm liệ

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
