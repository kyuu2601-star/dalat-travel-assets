# TravelOS live eval

- Thời điểm: 2026-11-07T05:49:24.976Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **97.5%**
- Critical failures: **L08, L24, L25, L26**
- Infra errors: **0**
- p95 latency: **32456 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L01 | PASS | Có | 16230 ms | — |
| L02 | PASS | Có | 22120 ms | — |
| L03 | PASS | Có | 10231 ms | — |
| L04 | PASS | Có | 119 ms | — |
| L05 | PASS | Có | 115 ms | — |
| L06 | PASS | Có | 131 ms | — |
| L07 | PASS | Có | 6481 ms | — |
| L08 | FAIL | Có | 13313 ms | all POIs match requested category: Cửa Hàng Mỹ Phẩm Guardian |
| L09 | PASS | Không | 158 ms | — |
| L10 | PASS | Không | 21354 ms | — |
| L11 | PASS | Có | 34806 ms | — |
| L12 | PASS | Có | 135 ms | — |
| L13 | PASS | Có | 607 ms | — |
| L14 | PASS | Có | 9743 ms | — |
| L15 | PASS | Có | 806 ms | — |
| L16 | PASS | Không | 10300 ms | — |
| L17 | PASS | Không | 17584 ms | — |
| L18 | PASS | Không | 13901 ms | — |
| L19 | PASS | Có | 26082 ms | — |
| L20 | PASS | Có | 19980 ms | — |
| L21 | PASS | Có | 32456 ms | — |
| L22 | PASS | Không | 7369 ms | — |
| L23 | PASS | Không | 7286 ms | — |
| L24 | FAIL | Có | 5438 ms | router GPS policy: false vs true |
| L25 | FAIL | Có | 11133 ms | intent: PLACE_DISCOVERY vs SAFETY_HEALTH |
| L26 | FAIL | Có | 4242 ms | router GPS policy: false vs true |
| L27 | PASS | Không | 13575 ms | — |
| L28 | PASS | Không | 15464 ms | — |
| L29 | PASS | Không | 13797 ms | — |
| L30 | PASS | Không | 180 ms | — |

## Manual review còn lại

### L01 — Tìm cửa hàng tiện lợi quanh TP.HCM
- [ ] Kết quả đầu phải đúng loại cửa hàng tiện lợi và tên/địa chỉ đủ nhận diện.

Trả lời: Pipi gửi bạn danh sách các cửa hàng tiện lợi gần vị trí hiện tại: 1. **Circle K** - Khoảng cách: ~234m - Địa chỉ: Đường Lý Tự Trọng, Phường Sài Gòn, Thành phố Hồ Chí Minh 2. **7-Eleven** - Khoảng cách: ~243m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 3. **7-Eleven** - Khoảng cách: ~251m - Địa chỉ: Đường Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 4. **Shop&Go!** - Khoảng cách: ~262m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 5. **Circle K** - Khoảng cách: ~264m - Địa chỉ: Hẻm 59 Nguyễn Du, Phường Sài Gòn, Thành phố Hồ Chí Minh 6. **Circle K** - Khoảng cách: ~290m - Địa chỉ: Đường Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh 7. **Family

### L02 — Tìm nhà thuốc quanh GPS Trùng Khánh
- [ ] Tên/địa chỉ tiếng Trung phải đủ đọc hoặc có bản địa hóa để nhận diện.

Trả lời: Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Jianzhijia Pharmacy (Chongqing Zaolanyā) (健之佳健康药房 · 重庆枣子岚垭店) — 92 m · Quận Du Trung, Trùng Khánh (嘉和苑东门旁 · 大礼堂地铁站1号口步行300米). - 2. Nhà thuốc Chân Thiện Mỹ (Zaozi Lanya, Yuzhong) (真善美药房 · 渝中区枣子岚垭店) — 110 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街120-附3号附近). - 3. Wanhe Pharmacy (đường Renhe) (万和医药连锁 · 人和街店) — 110 m · Quận Du Trung, Trùng Khánh (人和街42号菜市场 · 大礼堂地铁站2号口步行50米). - 4. Nhà thuốc Đường Thị (Chi nhánh Tòa nhà Khoa Phổ, ngõ Hoa Phúc) (唐氏大药房 · 华福巷科普大厦店) — 140 m · Quận Du Trung, Trùng Khánh (人和街140号 · 大礼堂地铁站2号口步行100米). - 5. Hòa Bình Pharmacy (Zaozi Lanya) (和平药房 · 枣子岚垭店) — 178 m · Quận Du Trung, Trùng Khánh (枣子岚垭正街55号 · 大礼堂地铁站1号口步行430米). Bạn bấm vào da

### L03 — Thời tiết Đà Lạt không dùng nhầm GPS TP.HCM
- [ ] Kết luận có/không tiện đi chơi phải bám điều kiện thời tiết trả về.

Trả lời: Ở Đà Lạt, hiện tại Mưa phùn dày, 23°C. Nhìn 8 giờ tới (16–22°C), thời tiết **không thật sự tiện để đi chơi ngoài trời**. Nếu vẫn đi, bạn nên ưu tiên điểm trong nhà, mang ô/áo mưa và chừa thời gian di chuyển.

### L07 — Tạo tuyến đi bộ tới landmark ở TP.HCM
- [ ] Điểm đến phải là Dinh Độc Lập; thời gian và quãng đường phải hợp lý với vị trí xuất phát.

Trả lời: Chào bạn, Pipi xin gửi hướng dẫn đường đi bộ từ vị trí hiện tại đến Dinh Độc Lập (địa chỉ: 135 Nam Kỳ Khởi Nghĩa, Phường Bến Thành, Thành phố Hồ Chí Minh) như sau: - **Phương tiện:** Đi bộ - **Khoảng cách:** 959 mét - **Thời gian di chuyển dự kiến:** Khoảng 13 đến 14 phút (800 giây) - **Tình trạng giao thông / Lưu ý:** Tuyến đường có một số đoạn bị giới hạn sử dụng hoặc là đường riêng theo dữ liệu bản đồ. **Chi tiết các bước di chuyển:** 1. Đi về hướng Đông Bắc về phía Đồng Khởi (đoạn đường bị giới hạn sử dụng, đi qua Ceci Cela - Vincom Đồng Khởi ở bên phải cách 32m) trong khoảng 51 mét (38 giây). 2. Rẽ trái tại Cyber Real - Văn Phòng Cho Thuê TPHCM vào Đồng Khởi (đi qua Gánh Mưu Sinh ở bên

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Công trường Lam Sơn — 351 m · Công trường Lam Sơn, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 2. Hiệu Thuốc Số 3 — 406 m · Hiệu Thuốc Số 3, Đường Tôn Thất Thiệp, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 3. Đường Hàm Nghi — 656 m · Đường Hàm Nghi, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 4. Đường Hàm Nghi — 679 m · Đường Hàm Nghi, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 5. Pharmacity — 714 m · Pharmacity, Đường Pasteur, Phường Xuân Hòa, Thành phố Hồ Chí Minh, 72421, Việt Nam. Bạn bấm vào danh sách/bản đồ bên dưới để xem vị

### L10 — Lịch trình một ngày lấy điểm từ D1
- [ ] Mọi địa điểm trong câu trả lời phải có trong curated evidence.
- [ ] Lịch trình phải có thứ tự hợp lý và không hứa đã kiểm route/giờ mở cửa nếu chưa có evidence.

Trả lời: Lịch trình gợi ý từ các điểm Let's Go Pipi đã có: Buổi sáng 08:30 — Vị Dalat. Buổi trưa 11:30 — Émai Dallat Coffee. Buổi chiều 14:30 — Tiệm Nướng Xèo Xèo Đà Lạt. Buổi tối 18:30 — Cala Lily Dalat. Đây là khung tham khảo; Pipi chưa xác minh tuyến đường và giờ mở cửa cho từng điểm.

### L11 — Xác nhận khách sạn trước khi tìm ăn chơi
- [ ] Lượt đầu chỉ được xác nhận khách sạn; lượt sau mới tìm địa điểm quanh đúng tọa độ khách sạn.

Trả lời: Pipi tìm thấy khách sạn này: **Khách sạn Yitel Premium (Chi nhánh Giải Phóng Bi, Hồng Nhai Động, Trùng Khánh) (和颐至尚酒店(重庆解放碑洪崖洞店))** — Số 30, đường nhánh Lâm Giang (cách lối ra số 1 ga tàu điện ngầm Lâm Giang Môn 450m đi bộ), quận Du Trung, thành phố Trùng Khánh (临江支路30号(临江门地铁站1号口步行450米)). Đây có đúng chỗ bạn nói không? Các chi nhánh khác: 2. Khách sạn Yitel (Chi nhánh Quảng trường Vạn Đạt Nam Bình, Ga tàu điện nhẹ Trùng Khánh) (和颐酒店(重庆南坪万达广场轻轨站店)) — Số 186, đường Huệ Công, Nam Bình, quận Nam Ngạn, thành phố Trùng Khánh (南坪惠工路186号) 3. Khách sạn Yitel (Chi nhánh Ga tàu điện nhẹ Songbei, Trùng Khánh) (和颐酒店(重庆双碑轻轨站店)) — Số 34, đường Songbei, ngách phụ 10-1, quận Sa Bình Bá, thành phố Trùng Khánh / Pipi đã lấy Khách sạn Yitel Premium (Chi nhánh Giải Phóng Bi, Hồng Nhai Động, Trùng Khánh) (和颐至尚酒店(重庆解放碑洪崖洞店)) (Số 30, đường nhánh Lâm Giang (cách lối ra số 1 ga tàu điện ngầm Lâm Giang Môn 450m đi bộ), quận Du Trung, thành phố Trùng Khánh (临江支路30号(临江门地铁站1号口步行450米))) làm điểm tìm. Đây là 10 nơi gần khách sạn nhất: - 1. Du thuyền cảnh đêm Lưỡng Giang Trùng Khánh (重庆两江夜景游船) — 32 m. - 2. Trùng Khánh Hồ Điệp Tập (重庆蝴蝶集) — 59 m. - 3. Du thuyền cảnh đêm Lưỡng Giang Tứ Ngạn (两江四岸夜景游船) — 59 m. - 4. Đ

### L12 — GPS quá cũ và sai số lớn phải bị từ chối
- [ ] Case này cố ý kiểm tra guardrail GPS freshness; nếu fail thì app đang dùng tọa độ cũ/sai số lớn như GPS hợp lệ.

Trả lời: Pipi cần cập nhật lại vị trí GPS trước khi tìm kiếm hoặc chỉ đường. Bạn chờ một chút nhé.
