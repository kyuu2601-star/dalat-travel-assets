# Kết quả mở rộng Shadow Router — 2026-11-07

## Kết luận

Chưa được bật Shadow Router thành Router điều khiển thật.

- Tổng số case chuyên biệt: **150**.
- Router + deterministic planner: **76/120 đạt**, **44 lỗi**, điểm **63,3%**.
- Production live: **20/30 đạt**, **10 lỗi**, structural **93,4%**.
- Critical live failures còn lại: **L24, L25, L26**.
- 16 case gốc: **16/16 đạt**. Các luồng đã kiểm trước đây không bị Shadow Router làm thay đổi.
- Infra errors: **0**.

## Lỗi đã xác nhận

### 1. Router nhận diện sai do khớp một phần từ

- `Đà Nẵng` bị khớp với `nắng` và đoán thành thời tiết.
- `bảo tàng` bị khớp với `bão` và đoán thành thời tiết.
- `trời gần đây` bị ưu tiên thành tìm địa điểm thay vì thời tiết.

### 2. Router thiếu cách nói phổ biến

- Các biến thể `tới`, `cách đi đến`, `route` và tuyến A → B đã được bổ sung; một số câu route tới loại địa điểm gần nhất vẫn còn lệch giữa planner và Router.
- Chưa hiểu `Plan chuyến đi`, `lập lịch ... một ngày` là itinerary trong mọi biến thể.
- Chưa đưa `Hello Pipi` và một số câu văn hóa/giao tiếp vào guided chat.
- Chưa đánh dấu GPS hiện tại cho các cách nói như `gần tôi`, `chỗ tôi`, hoặc câu cần nơi trợ giúp nhưng không nói `quanh đây`.

### 3. Safety intent còn thiếu

- `chóng mặt` và `dị ứng` vẫn bị planner/Router xem như tìm địa điểm thường.
- `đau đầu dữ dội` vào đúng nhánh safety ở production, nhưng Router chưa yêu cầu GPS hiện tại.
- Nhóm safety-health offline hiện đạt **2/15** và vẫn là nhóm ưu tiên sửa tiếp theo.

### 4. Route Trung Quốc đã được sửa

- Mọi `resolve_place` tại Trung Quốc đều đi qua official alias hoặc bản dịch cấu trúc trước khi gọi AMap.
- Map Worker thử tuần tự nhiều query variant và vẫn giữ tên gốc làm fallback.
- Giải Phóng Bi ưu tiên `解放碑`, sau đó mới thử các biến thể dài hơn.
- Tuyến A → B resolve riêng origin và destination, không dùng GPS thay cho origin đã nêu.
- Case kiểm thử đã dùng đúng tên `Lễ Đường Nhân Dân` thay cho `Quảng trường Nhân Dân`.
- Live recheck L19–L21: **3/3 PASS**, structural **100%**, không có critical failure.

## Kết quả theo nhóm offline

| Nhóm | Đạt | Tổng | Điểm |
|---|---:|---:|---:|
| Tìm quanh vị trí hiện tại | 11 | 15 | 73,3% |
| Tìm ở khu vực khác | 11 | 15 | 73,3% |
| Route từ vị trí hiện tại | 9 | 15 | 60,0% |
| Route hai điểm | 15 | 15 | 100,0% |
| Thời tiết | 10 | 15 | 66,7% |
| Safety/health | 2 | 15 | 13,3% |
| Lịch trình | 10 | 15 | 66,7% |
| Guided chat | 8 | 15 | 53,3% |

## Điều kiện trước khi bật Router

- Tổng điểm Router tối thiểu **95%**.
- Route và safety-health phải đạt **100%** trong bộ critical.
- Live eval không còn critical failure.
- Không được dùng GPS hiện tại cho câu hỏi có destination rõ ràng ở nơi khác.
- Không được tạo route khi destination chưa resolve được.
- Router vẫn giữ `applied=false` cho tới khi toàn bộ điều kiện trên đạt.

