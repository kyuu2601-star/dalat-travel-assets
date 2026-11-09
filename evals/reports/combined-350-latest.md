# TravelOS combined eval — 350 case

- Thời điểm: 2026-11-09T02:53:17.173Z
- Tổng: **280/350 đạt (80%)**
- Lỗi: **47**
- Infra: **23**

| Bộ eval | Case | Đạt | Lỗi | Infra | Điểm |
|---|---:|---:|---:|---:|---:|
| 120 router | 120 | 102 | 18 | 0 | 85% |
| 30 live | 30 | 26 | 4 | 0 | 97.5% |
| 100 knowledge | 100 | 98 | 2 | 0 | 98% |
| 100 chat + translate | 100 | 54 | 23 | 23 | 54% |
| **Tổng** | **350** | **280** | **47** | **23** | **80%** |

## 100 case mới nhất

- Text Chat: **48/50 đạt**, 2 lỗi.
- Voice Live Việt → Trung: **4/25 đạt**, 17 lỗi nội dung, 4 lỗi hạ tầng.
- Voice Live Trung → Việt: **2/25 đạt**, 4 lỗi nội dung, 19 lỗi hạ tầng.

Các lỗi Voice Live chủ yếu là transcript/bản dịch bị chốt khi câu chưa kết thúc. Các lỗi hạ tầng là phiên Live đã mở nhưng không trả transcript hoặc audio trong thời hạn kiểm thử.
