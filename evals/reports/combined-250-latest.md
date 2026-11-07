# TravelOS combined eval — 250 case

- Thời điểm: 2026-11-07T05:29:07.283Z
- Bản public: https://ai-test.kyuu2601.workers.dev
- Worker version: 062445bf-f845-4d94-b4ae-bf78934597cb
- Tổng: **227/250 đạt (90.8%)**

| Bộ eval | Case | Đạt | Lỗi | Điểm |
|---|---:|---:|---:|---:|
| 120 router cũ | 120 | 102 | 18 | 85% |
| 30 live cũ | 30 | 27 | 3 | 97.5% structural |
| 100 knowledge mới | 100 | 98 | 2 | 98% |
| **Tổng** | **250** | **227** | **23** | **90.8%** |

## Phạm vi giữ nguyên

- Không đổi thứ tự xử lý request.
- Không đổi API bản đồ, tool, model fallback, prompt trả lời hoặc UI.
- Router vẫn ở chế độ shadow, không điều khiển luồng thật.

## Lỗi còn lại cần đổi luồng mới xử lý được

Một số câu triệu chứng có kèm yêu cầu “bác sĩ/phòng khám gần…” bị nhánh tìm địa điểm hiện tại bắt trước nhánh SAFETY_HEALTH. Các lỗi này được giữ nguyên và báo thẳng vì yêu cầu lần này chỉ cho phép bổ sung database nhận diện.
