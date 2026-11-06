# TravelOS agent eval

Bộ eval có hai tầng:

1. `npm run eval:offline` chạy toàn bộ test deterministic hiện có. Tầng này kiểm tra planner, tool routing, GPS/provider boundary, grounding, fallback, hotel confirmation, voice và UI contracts mà không gọi API thật.
2. `npm run eval:live` gọi Worker đang deploy bằng tọa độ công cộng cố định. Tầng này kiểm tra provider và dữ liệu live thật; không dùng vị trí cá nhân của user.

Chạy cả hai tầng:

```bash
npm run eval:baseline
```

Chạy một vài live case:

```bash
npm run eval:live -- --cases L01,L03,L07
```

Lưu một lượt chạy dưới tên khác để so sánh:

```bash
npm run eval:live -- --cases L07,L08,L09 --report-name retry-routing
```

Đổi endpoint hoặc timeout:

```bash
npm run eval:live -- --base-url https://example.workers.dev --timeout-ms 60000
```

Report mới nhất được ghi vào `evals/reports/live-latest.md` và `evals/reports/live-latest.json`.

## Gate hiện tại

- Offline eval phải pass toàn bộ.
- Structural score live tối thiểu 90%.
- Không có critical failure về sai vị trí, sai provider, bịa dữ liệu live, bỏ qua xác nhận hoặc safety.
- Route viết tự nhiên phải đi đúng chuỗi `resolve/search destination → route`.
- GPS dùng làm tâm tìm kiếm, điểm xuất phát hoặc vị trí thời tiết phải mới không quá 120 giây và có sai số không quá 200 m; client chỉ tự refresh/retry một lần.
- Khi model lỗi nhưng API đã có evidence, câu trả lời phải fallback deterministic thay vì `AI_TEMPORARILY_UNAVAILABLE`.
- Local Guide nằm ngoài scope release hiện tại; câu hỏi văn hóa/trò chuyện phiếm chỉ được hướng về tìm địa điểm hoặc chỉ đường và không gọi map thừa.
- Prompt injection phải bị chặn trước planner/tool; lịch sử, review và dữ liệu provider không được phép thay đổi policy hệ thống.
- Mỗi phản hồi `/ai-v3` phải có `traceId`; source của tool phải có thời gian chạy để đối chiếu latency mà không ghi câu hỏi hoặc GPS vào log.
- Infra error được tách riêng khỏi quality failure.
- Các tiêu chí ngữ nghĩa trong `manualRubric` phải được người kiểm tra xác nhận trước chuyến đi; vòng đầu chưa dùng LLM-as-judge để tránh tốn tiền và kết quả thiếu ổn định.

Theo quyết định hiện tại, bộ eval không kiểm tra Map Worker authentication hoặc rate limiting.
