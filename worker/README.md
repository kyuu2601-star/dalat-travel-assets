# TravelOS AI + D1 Worker

Worker này giữ system prompt, semantic planner, tool orchestration và dữ liệu D1. Frontend không còn gửi prompt/keyword modules lên Worker.

Routes:
- `POST /ai-v3` — flow mới: plan -> tools -> evidence -> grounded answer
- `POST /ai` hoặc `/` — flow v2 tạm giữ để rollback
- `GET /api/health`
- `GET /api/places`
- `POST /api/places`

Setup outline:
1. Create a Cloudflare D1 database named `travelos`.
2. Run `schema.sql` against the database.
3. Copy `wrangler.toml.example` to `wrangler.toml`, set the D1 database id and allowed GitHub Pages origin.
4. Thêm Service Binding `MAP_WORKER` trỏ tới Worker `travelos-map` (hoặc cấu hình `MAP_WORKER_URL`).
5. Thêm secrets rồi deploy:

   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put ADMIN_KEY
   wrangler secret put BESTTIME_PRIVATE_KEY
   wrangler deploy
   ```

6. Deploy Map Worker trước AI Worker để toàn bộ tools sẵn sàng.
7. Trong `config.js`, đặt `DATA_API_URL` tới URL `/api`, bật `D1_ENABLED` và giữ `AI_PATH: "/ai-v3"`.
8. Migrate dữ liệu vào bảng `places`.

## Kho kiến thức món ăn và chuỗi quán

`schema.sql` tạo thêm bốn bảng D1: `food_categories`, `food_dishes`,
`food_affinities`, `venue_brands`. Bộ dữ liệu khởi đầu nằm trong
`src/bot/food-knowledge.js`; chạy `node scripts/build-food-knowledge-seed.mjs`
từ thư mục gốc để tạo lại `worker/food-knowledge-seed.sql`. Nạp SQL này vào D1
sau khi chạy schema. Lệnh seed chỉ thêm mã chưa có, nên các chỉnh sửa trực tiếp
trong D1 sẽ được giữ nguyên.

Mỗi quan hệ món–loại quán có `confidence` từ 0 đến 1. Đây là khả năng dùng để
tìm ứng viên và xếp hạng, không phải xác nhận một chi nhánh đang bán món đó.
Chỉ menu, tag hoặc review có nội dung cụ thể mới là bằng chứng về món ăn.
Worker đọc D1 cho từng yêu cầu; nếu bảng chưa được tạo hoặc tạm lỗi, Worker dùng
bộ dữ liệu khởi đầu trong code.

The frontend Add Place form becomes visible only when D1 is enabled.

## V3 tools

- `search_places`, `resolve_place`, `place_details`
- `weather`
- `place_busyness` dùng BestTime live/forecast và luôn phân biệt dữ liệu live với dự báo
- `walking_route`, `traffic_route`
- `curated_places` cho recommendation/lịch trình từ D1

Mọi fact live được đóng gói thành evidence trước khi Gemini tạo câu trả lời cuối.
