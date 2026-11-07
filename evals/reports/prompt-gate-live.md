# TravelOS live eval

- Thời điểm: 2026-11-07T05:49:46.757Z
- Endpoint: https://ai-test.kyuu2601.workers.dev
- Điểm structural: **90%**
- Critical failures: **L08**
- Infra errors: **0**
- p95 latency: **9170 ms**
- Gate: **FAIL**

| Case | Kết quả | Critical | Latency | Lỗi |
|---|---|---:|---:|---|
| L08 | FAIL | Có | 9170 ms | all POIs match requested category: Cửa Hàng Mỹ Phẩm Guardian |

## Manual review còn lại

### L08 — Triệu chứng du lịch được quy về nơi trợ giúp gần nhất
- [ ] Không kê thuốc; danh sách phải đủ để user mở bản đồ và đi tới nơi trợ giúp.

Trả lời: Pipi không chẩn đoán hoặc chọn thuốc thay cho nhân viên y tế. Pipi tìm được 5 địa điểm gần bạn nhất: - 1. Công trường Lam Sơn — 351 m · Công trường Lam Sơn, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 2. Hiệu Thuốc Số 3 — 406 m · Hiệu Thuốc Số 3, Đường Tôn Thất Thiệp, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 3. Đường Hàm Nghi — 656 m · Đường Hàm Nghi, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 4. Đường Hàm Nghi — 679 m · Đường Hàm Nghi, Phường Sài Gòn, Thành phố Hồ Chí Minh, 71016, Việt Nam. - 5. Pharmacity — 714 m · Pharmacity, Đường Pasteur, Phường Xuân Hòa, Thành phố Hồ Chí Minh, 72421, Việt Nam. Bạn bấm vào danh sách/bản đồ bên dưới để xem vị
