# TravelOS combined eval — 250 case

- Thời điểm: 2026-11-07T05:50:14.126Z
- Bản public: https://ai-test.kyuu2601.workers.dev
- Worker version: 10874878-61eb-430e-afcb-270e04de6543
- Tổng: **226/250 đạt (90.4%)**

| Bộ eval | Case | Đạt | Lỗi | Điểm |
|---|---:|---:|---:|---:|
| 120 router cũ | 120 | 102 | 18 | 85% |
| 30 live cũ | 30 | 26 | 4 | 97.5% structural |
| 100 knowledge mới | 100 | 98 | 2 | 98% |
| **Tổng** | **250** | **226** | **24** | **90.4%** |

## Phạm vi giữ nguyên

- Không đổi thứ tự xử lý request.
- Không đổi API bản đồ, tool, model fallback, prompt trả lời hoặc UI.
- Router vẫn ở chế độ shadow, không điều khiển luồng thật.

## Lỗi còn lại cần đổi luồng mới xử lý được

Một số câu triệu chứng có kèm yêu cầu “bác sĩ/phòng khám gần…” bị nhánh tìm địa điểm hiện tại bắt trước nhánh SAFETY_HEALTH. Các lỗi này được giữ nguyên và báo thẳng vì yêu cầu lần này chỉ cho phép bổ sung database nhận diện.
