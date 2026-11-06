# Kết quả mở rộng Shadow Router — 2026-11-07

## Kết luận

Chưa được bật Shadow Router thành Router điều khiển thật.

- Tổng số case chuyên biệt: **150**.
- Router + deterministic planner: **73/120 đạt**, **47 lỗi**, điểm **60,8%**.
- Production live: **17/30 đạt**, **13 lỗi**, structural **89,7%**.
- Critical live failures: **L19, L20, L21, L24, L25, L26**.
- 16 case gốc: **16/16 đạt**. Các luồng đã kiểm trước đây không bị Shadow Router làm thay đổi.
- Infra errors: **0**.

## Lỗi đã xác nhận

### 1. Router nhận diện sai do khớp một phần từ

- `Đà Nẵng` bị khớp với `nắng` và đoán thành thời tiết.
- `bảo tàng` bị khớp với `bão` và đoán thành thời tiết.
- `trời gần đây` bị ưu tiên thành tìm địa điểm thay vì thời tiết.

### 2. Router thiếu cách nói phổ biến

- Chưa hiểu ổn định `tới`, `đưa tôi tới`, `cách đi đến`, `route` và một số tuyến A → B.
- Chưa hiểu `Plan chuyến đi`, `lập lịch ... một ngày` là itinerary trong mọi biến thể.
- Chưa đưa `Hello Pipi` và một số câu văn hóa/giao tiếp vào guided chat.
- Chưa đánh dấu GPS hiện tại cho các cách nói như `gần tôi`, `chỗ tôi`, hoặc câu cần nơi trợ giúp nhưng không nói `quanh đây`.

### 3. Safety intent còn thiếu

- `chóng mặt` và `dị ứng` vẫn bị planner/Router xem như tìm địa điểm thường.
- `đau đầu dữ dội` vào đúng nhánh safety ở production, nhưng Router chưa yêu cầu GPS hiện tại.
- Nhóm safety-health offline chỉ đạt **3/15**.

### 4. Route Trung Quốc có lỗi ngoài Router

Ba yêu cầu đã vào đúng `ROUTE_MOBILITY` và gọi đúng `resolve_place → walking_route`, nhưng AMap không resolve được tên tiếng Việt nên trả **0 tuyến**:

- Hồng Nhai Động.
- Quảng trường Nhân Dân.
- Giải Phóng Bi trong câu tuyến hai điểm dùng từ `tới`.

Đây là lỗi resolve destination/alias trước khi gọi route, không phải lỗi điều phối model.

## Kết quả theo nhóm offline

| Nhóm | Đạt | Tổng | Điểm |
|---|---:|---:|---:|
| Tìm quanh vị trí hiện tại | 11 | 15 | 73,3% |
| Tìm ở khu vực khác | 11 | 15 | 73,3% |
| Route từ vị trí hiện tại | 7 | 15 | 46,7% |
| Route hai điểm | 13 | 15 | 86,7% |
| Thời tiết | 10 | 15 | 66,7% |
| Safety/health | 3 | 15 | 20,0% |
| Lịch trình | 10 | 15 | 66,7% |
| Guided chat | 8 | 15 | 53,3% |

## Điều kiện trước khi bật Router

- Tổng điểm Router tối thiểu **95%**.
- Route và safety-health phải đạt **100%** trong bộ critical.
- Live eval không còn critical failure.
- Không được dùng GPS hiện tại cho câu hỏi có destination rõ ràng ở nơi khác.
- Không được tạo route khi destination chưa resolve được.
- Router vẫn giữ `applied=false` cho tới khi toàn bộ điều kiện trên đạt.

