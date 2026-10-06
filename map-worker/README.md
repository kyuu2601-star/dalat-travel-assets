# TravelOS Map Worker

Provider gateway cho POI, geocoding, place details, walking route và traffic.
Source dùng để deploy là `src/index.js` theo `wrangler.toml`.

Routes:

- `POST /poi/nearby`
- `POST /poi/details`
- `POST /place/resolve`
- `POST /route/walking`
- `POST /route/traffic`
- `GET /health`

Deploy và thêm secrets:

```bash
wrangler secret put GEOAPIFY_API_KEY
wrangler secret put AMAP_WEB_KEY
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler deploy
```

`GOOGLE_MAPS_API_KEY` là optional nhưng cần nếu muốn có business status, giờ mở cửa tốt hơn, rating/review và traffic live ngoài Trung Quốc. Key phải bật Places API (New) và Routes API.

Geoapify được dùng cho POI/geocoding/routing ngoài Trung Quốc. AMap được dùng tại Trung Quốc. Search pharmacy bao phủ cả `healthcare.pharmacy`, `commercial.health_and_beauty.pharmacy` và `commercial.chemist`.
