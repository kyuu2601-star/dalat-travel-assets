# TravelOS D1 API

Backend scaffold for the TravelOS place database.

Routes:
- `GET /api/health`
- `GET /api/places`
- `POST /api/places`

Setup outline:
1. Create a Cloudflare D1 database named `travelos`.
2. Run `schema.sql` against the database.
3. Copy `wrangler.toml.example` to `wrangler.toml`, set the D1 database id and allowed GitHub Pages origin.
4. Deploy this Worker.
5. In root `config.js`, set `DATA_API_URL` to the Worker URL ending in `/api` and set `D1_ENABLED: true`.
6. Migrate the existing Sheet rows into the `places` table. Once verified, remove `LEGACY_CSV_URL` fallback.

The frontend Add Place form becomes visible only when D1 is enabled.
