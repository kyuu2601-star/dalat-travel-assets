# TravelOS bot pipeline

Mỗi request đi qua ba lớp độc lập:

1. `planner/semantic-planner.js` chỉ bóc tách nhu cầu thành JSON có cấu trúc. Planner không gọi API và không viết câu trả lời cho user.
2. `library/api-registry.js` là thư viện năng lực API. Backend dùng danh sách này để biên dịch nhu cầu thành tool đã cho phép, chọn Google ngoài Trung Quốc và AMap tại Trung Quốc qua Map Worker.
3. `prompts/` chứa tám prompt trả lời tách biệt. Mỗi lượt chỉ `answerPromptFor(primaryIntent)` được gửi cho model viết câu trả lời; các prompt khác không đi kèm.

Parser deterministic vẫn xử lý các câu rõ ràng để giảm độ trễ và chi phí. Semantic planner chỉ chạy cho câu mơ hồ, câu đa nhu cầu hoặc khi parser cần hỏi lại. Nếu planner lỗi, backend quay về parser deterministic.

Các nhóm dữ liệu live chưa có adapter có một fallback capability nhỏ ở backend. Fallback này chỉ nhận diện loại nguồn còn thiếu để trả cảnh báo và gợi ý provider; nó không dùng keyword để tự quyết định địa điểm hoặc tạo dữ liệu thay cho API.

## Nhóm request đang hỗ trợ

- `PLACE_DISCOVERY`: tìm địa điểm, món, thương hiệu và tiện ích quanh một tâm điểm.
- `WEATHER_OUTDOOR`: thời tiết và khả năng đi chơi.
- `ROUTE_MOBILITY`: đi bộ, lái xe và giải thích tuyến.
- `ITINERARY_PLANNING`: lịch trình từ dữ liệu đã kiểm chứng.
- `VENUE_INTELLIGENCE`: mở cửa, rating, review và độ đông.
- `SAFETY_HEALTH`: an toàn, y tế và trợ giúp tại chỗ.
- `TRAVEL_UTILITY`: SIM, Wi-Fi, ATM, đổi tiền, vé, thanh toán và hành lý.
- `LOCAL_GUIDE`: văn hóa, món ăn, phép lịch sự và kiến thức địa phương ổn định.

## Nguồn dữ liệu còn thiếu

`api-registry.js` đánh dấu rõ các nhu cầu chưa có nguồn live thay vì cho model tự đoán: lịch phương tiện công cộng, giá/đặt vé, fact-check web, tỷ giá và tình trạng thanh toán/kết nối. Response API trả `missingApiSuggestions` để có thể bổ sung provider sau mà không sửa prompt.
