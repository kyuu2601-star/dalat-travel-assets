# TravelOS Map Worker

Provider gateway cho POI, geocoding, place details, walking/driving route và traffic.
Source dùng để deploy là `src/index.js` theo `wrangler.toml`.

Routes:

- `POST /poi/nearby`
- `POST /poi/details`
- `POST /place/resolve`
- `POST /route/walking`
- `POST /route/directions` (`mode: "drive" | "walk"`, có polyline và turn-by-turn)
- `POST /route/traffic`
- `GET /health`

Deploy và thêm secrets:

```bash
wrangler secret put GEOAPIFY_API_KEY
wrangler secret put AMAP_WEB_KEY
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler deploy
```

`GOOGLE_MAPS_API_KEY` là server key, dùng cho Places API (New) và Routes API. Giữ key này trong Cloudflare Secret; không đưa vào frontend.

Frontend dùng một key riêng tại `CONFIG.GOOGLE_MAPS_BROWSER_KEY`. Browser key chỉ bật Maps JavaScript API và phải giới hạn HTTP referrer theo domain GitHub Pages.

Google được dùng cho POI/geocoding/routing ngoài Trung Quốc. AMap được dùng tại Trung Quốc. Geoapify được giữ làm fallback nếu Google lỗi hoặc không có kết quả. Search pharmacy bao phủ cả Google type `pharmacy` và các category Geoapify tương ứng.
