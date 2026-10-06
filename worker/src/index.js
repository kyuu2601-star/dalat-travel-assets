const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnXggiUJriOBPHz05pt01aIq_qaCDeQAcWpyYTG6zx1XI9WzfVDTbb8rPwYPf2w8uHxeDpx3Tznx53/pub?gid=615358788&single=true&output=csv';

const LEGACY_LOCATION_MAP = {
  'da lat': { country: 'Việt Nam', city: 'Đà Lạt', area: '' },
  'da nang': { country: 'Việt Nam', city: 'Đà Nẵng', area: '' },
  'tp hcm': { country: 'Việt Nam', city: 'TP.HCM', area: '' },
  'ho chi minh': { country: 'Việt Nam', city: 'TP.HCM', area: '' },
  'vung tau': { country: 'Việt Nam', city: 'Vũng Tàu', area: '' },
  'phuong hoang': { country: 'Trung Quốc', city: 'Phượng Hoàng', area: '' },
  'thuong hai': { country: 'Trung Quốc', city: 'Thượng Hải', area: '' },
  'trung khanh': { country: 'Trung Quốc', city: 'Trùng Khánh', area: '' },
  'vu long': { country: 'Trung Quốc', city: 'Trùng Khánh', area: 'Vũ Long' },
  'ngoai o xa': { country: 'Việt Nam', city: 'Đà Lạt', area: 'Ngoại Ô Xa' }
};

const STOP_WORDS = new Set([
  'toi','tui','minh','ban','fen','cho','cua','va','voi','la','co','khong','nao','gi','nay','kia','mot','nhung','cac',
  'o','tai','gan','day','duoc','nhe','nha','a','oi','thi','ma','neu','muon','can','tim','xem','hoi','giup','review',
  'quan','tiem','dia','diem','noi','khu','vuc','recommend','suggest','goi','y'
]);

const ADMIN_WORDS = new Set(['quan','huyen','phuong','xa','tp','thanh','pho','tinh','district','ward','city','province']);
const clean = (v, max = 10000) => String(v ?? '').trim().slice(0, max);
const num = v => (v === '' || v == null || !Number.isFinite(Number(v))) ? null : Number(v);
const int = v => Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0;
const clamp = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const fold = v => clean(v)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normOrigin = v => clean(v, 500).replace(/\/$/, '');

function allowedOrigins(env) {
  return new Set(clean(env.ALLOWED_ORIGINS || 'https://kyuu2601-star.github.io', 5000).split(',').map(normOrigin).filter(Boolean));
}

function isOriginAllowed(request, env) {
  const origin = normOrigin(request.headers.get('Origin'));
  return !origin || allowedOrigins(env).has(origin);
}

function cors(request, env) {
  const origin = normOrigin(request.headers.get('Origin'));
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin && allowedOrigins(env).has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(request, env) }
  });
}

function adminKey(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return (request.headers.get('X-Admin-Key') || '').trim();
}

function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY chưa được cấu hình.' }, 503, request, env);
  if (adminKey(request) !== String(env.ADMIN_KEY)) return json({ error: 'Unauthorized' }, 401, request, env);
  return null;
}

// =========================================================
// R2 IMAGE IMPORT + SERVE
// =========================================================

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PAGE_BYTES = 1536 * 1024;
const MAX_IMAGE_REDIRECTS = 4;
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

function isPrivateIpv4(host) {
  const match = String(host || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const parts = match.slice(1).map(Number);
  if (parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function safeRemoteUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('Link ảnh không hợp lệ.'); }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Chỉ hỗ trợ link ảnh http/https.');

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
      isPrivateIpv4(host) || host.includes(':')) {
    throw new Error('Không cho phép URL nội bộ/private.');
  }
  return url;
}

async function fetchRemote(urlValue, headers = {}) {
  let url = safeRemoteUrl(urlValue);

  for (let i = 0; i <= MAX_IMAGE_REDIRECTS; i++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TravelOS-ImageImporter/1.0)',
        ...headers
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) throw new Error('Nguồn ảnh redirect nhưng không có Location.');
      url = safeRemoteUrl(new URL(location, url).toString());
      continue;
    }
    return response;
  }

  throw new Error('Nguồn ảnh redirect quá nhiều lần.');
}

async function readLimitedBytes(response, maxBytes) {
  const declared = Number(response.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Ảnh vượt giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error(`Ảnh vượt giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new Error(`Ảnh vượt giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function responseMime(response) {
  return clean(response.headers.get('Content-Type'), 200).split(';')[0].trim().toLowerCase();
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function detectImage(bytes, declaredMime = '') {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 8);
    if (brand.includes('avif') || brand.includes('avis')) return { mime: 'image/avif', ext: 'avif' };
  }
  return IMAGE_TYPES[declaredMime] ? { mime: declaredMime, ext: IMAGE_TYPES[declaredMime] } : null;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function findPageImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return '';
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadDirectImage(url) {
  const response = await fetchRemote(url, {
    Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.9,*/*;q=0.2'
  });
  if (!response.ok) throw new Error(`Nguồn ảnh HTTP ${response.status}.`);

  const bytes = await readLimitedBytes(response, MAX_IMAGE_BYTES);
  const type = detectImage(bytes, responseMime(response));
  if (!type) throw new Error('URL đích không trả file ảnh được hỗ trợ.');

  return { bytes, type, finalUrl: response.url || String(url) };
}

async function resolveSourceImage(sourceUrl) {
  const response = await fetchRemote(sourceUrl, {
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8'
  });
  if (!response.ok) throw new Error(`Nguồn ảnh HTTP ${response.status}.`);

  const mime = responseMime(response);
  if (mime.startsWith('image/')) {
    const bytes = await readLimitedBytes(response, MAX_IMAGE_BYTES);
    const type = detectImage(bytes, mime);
    if (!type) throw new Error('Định dạng ảnh chưa được hỗ trợ.');
    return { bytes, type, finalUrl: response.url || String(sourceUrl) };
  }

  const htmlBytes = await readLimitedBytes(response, MAX_IMAGE_PAGE_BYTES);
  const html = new TextDecoder('utf-8').decode(htmlBytes);
  const candidate = findPageImage(html);
  if (!candidate) {
    throw new Error('Link là trang web nhưng không tìm thấy og:image/twitter:image. Hãy dùng direct image URL.');
  }

  return loadDirectImage(new URL(candidate, response.url || sourceUrl).toString());
}

function isManagedImageUrl(value, request) {
  const raw = clean(value, 3000);
  if (!raw) return false;

  try {
    const url = new URL(raw);
    const workerOrigin = new URL(request.url).origin;
    return url.origin === workerOrigin && url.pathname.startsWith('/images/');
  } catch {
    return false;
  }
}

async function importImageToR2(sourceUrl, placeName, request, env) {
  if (!env.IMAGES) throw new Error('R2 binding IMAGES chưa được cấu hình.');

  const source = clean(sourceUrl, 3000);
  if (!source || isManagedImageUrl(source, request)) return source;

  safeRemoteUrl(source);
  const { bytes, type, finalUrl } = await resolveSourceImage(source);
  const hash = await sha256Hex(bytes);
  const key = `places/${hash.slice(0, 2)}/${hash}.${type.ext}`;

  const existing = await env.IMAGES.head(key);
  if (!existing) {
    await env.IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: type.mime,
        cacheControl: 'public, max-age=31536000, immutable'
      },
      customMetadata: {
        sourceUrl: clean(finalUrl || source, 1024),
        importedAt: new Date().toISOString(),
        placeName: clean(placeName, 200)
      }
    });
  }

  return `${new URL(request.url).origin}/images/${key}`;
}

async function importImageEndpoint(request, env) {
  const body = await request.json().catch(() => ({}));
  const url = clean(body.url, 3000);
  if (!url) throw new Error('url is required');

  return {
    url: await importImageToR2(url, clean(body.name, 300), request, env)
  };
}


const MIGRATABLE_IMAGE_FIELDS = new Set(['image_url', 'warning_image']);

function getMigrationFields(body) {
  const requested = Array.isArray(body?.fields) ? body.fields.map(v => clean(v, 50)) : [];
  const fields = requested.filter(field => MIGRATABLE_IMAGE_FIELDS.has(field));
  return fields.length ? [...new Set(fields)] : ['image_url', 'warning_image'];
}

async function migrationRemaining(request, env, fields) {
  const managedPrefix = `${new URL(request.url).origin}/images/%`;
  const counts = {};
  let total = 0;

  for (const field of fields) {
    const row = await env.DB.prepare(`
      SELECT COUNT(*) count FROM places
      WHERE ${field} IS NOT NULL AND TRIM(${field})<>'' AND ${field} NOT LIKE ?
    `).bind(managedPrefix).first();

    counts[field] = Number(row?.count || 0);
    total += counts[field];
  }

  return { total, ...counts };
}

async function updateMigratedImageField(env, id, field, oldUrl, newUrl) {
  const sql = field === 'warning_image'
    ? 'UPDATE places SET warning_image=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND warning_image=?'
    : 'UPDATE places SET image_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND image_url=?';

  const result = await env.DB.prepare(sql).bind(newUrl, id, oldUrl).run();
  return Number(result?.meta?.changes || 0) > 0;
}

async function migrateImages(request, env) {
  if (!env.DB) throw new Error('D1 binding DB chưa được cấu hình.');
  if (!env.IMAGES) throw new Error('R2 binding IMAGES chưa được cấu hình.');

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun !== false;
  const limit = clamp(body.limit, 1, 20, 10);
  const afterId = clamp(body.afterId, 0, 2147483647, 0);
  const fields = getMigrationFields(body);

  const result = await env.DB.prepare(`
    SELECT id,name,image_url,warning_image
    FROM places
    WHERE id>?
    ORDER BY id
    LIMIT ?
  `).bind(afterId, limit).all();

  const rows = result.results || [];
  let candidates = 0;
  let migrated = 0;
  let skippedAlreadyR2 = 0;
  let failed = 0;
  let stale = 0;
  const items = [];

  for (const row of rows) {
    for (const field of fields) {
      const source = clean(row?.[field], 3000);
      if (!source) continue;

      if (isManagedImageUrl(source, request)) {
        skippedAlreadyR2++;
        continue;
      }

      candidates++;

      if (dryRun) {
        items.push({
          id: Number(row.id),
          name: clean(row.name, 300),
          field,
          status: 'would_migrate',
          source
        });
        continue;
      }

      try {
        const storedUrl = await importImageToR2(
          source,
          field === 'warning_image' ? `${row.name} [warning]` : row.name,
          request,
          env
        );

        const updated = await updateMigratedImageField(
          env,
          Number(row.id),
          field,
          source,
          storedUrl
        );

        if (updated) {
          migrated++;
          items.push({
            id: Number(row.id),
            name: clean(row.name, 300),
            field,
            status: 'migrated',
            source,
            url: storedUrl
          });
        } else {
          stale++;
          items.push({
            id: Number(row.id),
            name: clean(row.name, 300),
            field,
            status: 'not_updated',
            source,
            url: storedUrl,
            error: 'Record đã thay đổi trong lúc migrate, D1 không bị overwrite.'
          });
        }
      } catch (error) {
        failed++;
        items.push({
          id: Number(row.id),
          name: clean(row.name, 300),
          field,
          status: 'failed',
          source,
          error: clean(error?.message || 'Không import được ảnh.', 1000)
        });
      }
    }
  }

  const nextAfterId = rows.length ? Number(rows[rows.length - 1].id) : afterId;
  const nextRow = rows.length
    ? await env.DB.prepare('SELECT id FROM places WHERE id>? ORDER BY id LIMIT 1').bind(nextAfterId).first()
    : null;
  const scanDone = rows.length === 0 || !nextRow;
  const remaining = await migrationRemaining(request, env, fields);

  return {
    dryRun,
    fields,
    limit,
    afterId,
    processedRows: rows.length,
    candidates,
    migrated,
    skippedAlreadyR2,
    failed,
    stale,
    nextAfterId,
    scanDone,
    allMigrated: !dryRun && scanDone && remaining.total === 0,
    remaining,
    items
  };
}

async function serveR2Image(request, env, key) {
  if (!env.IMAGES) return new Response('R2 binding missing', { status: 503 });
  if (!key) return new Response('Not found', { status: 404 });

  const object = request.method === 'HEAD' ? await env.IMAGES.head(key) : await env.IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

// =========================================================
// D1 SCHEMA
// =========================================================

async function ensureSchema(env) {
  if (!env.DB) throw new Error('D1 binding DB chưa được cấu hình.');

  const sqls = [
    `CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', map_link TEXT NOT NULL DEFAULT '', latitude REAL, longitude REAL,
      recommend TEXT NOT NULL DEFAULT '', move_difficulty TEXT NOT NULL DEFAULT 'Dễ', road_note TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '', open_time_1 TEXT NOT NULL DEFAULT '', open_time_2 TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL DEFAULT '', ticket TEXT NOT NULL DEFAULT '', warning_image TEXT NOT NULL DEFAULT '',
      warning_text TEXT NOT NULL DEFAULT '', warning_latitude REAL, warning_longitude REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_places_location ON places(country, city, area)`,
    `CREATE INDEX IF NOT EXISTS idx_places_name ON places(name)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_places_unique ON places(name, city, area, map_link)`,
    `CREATE TABLE IF NOT EXISTS ai_rate_limits (
      ip TEXT NOT NULL, minute_bucket INTEGER NOT NULL, request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, minute_bucket)
    )`
  ];

  for (const sql of sqls) await env.DB.prepare(sql).run();
}

async function rateLimit(request, env) {
  if (!env.DB) return true;
  const limit = clamp(env.AI_RATE_LIMIT_PER_MINUTE, 1, 300, 30);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / 60000);

  try {
    await env.DB.prepare(`
      INSERT INTO ai_rate_limits(ip, minute_bucket, request_count) VALUES (?, ?, 1)
      ON CONFLICT(ip, minute_bucket) DO UPDATE SET request_count = request_count + 1
    `).bind(ip, bucket).run();

    const row = await env.DB.prepare('SELECT request_count FROM ai_rate_limits WHERE ip=? AND minute_bucket=?').bind(ip, bucket).first();
    return Number(row?.request_count || 0) <= limit;
  } catch {
    return true;
  }
}

// =========================================================
// PLACES CRUD
// =========================================================

function normalizePlace(body) {
  return {
    name: clean(body.name, 300), country: clean(body.country, 120), city: clean(body.city, 120), area: clean(body.area, 160),
    category: clean(body.category, 300), map_link: clean(body.map_link, 2000), latitude: num(body.latitude), longitude: num(body.longitude),
    recommend: clean(body.recommend), move_difficulty: clean(body.move_difficulty, 200) || 'Dễ', road_note: clean(body.road_note, 5000),
    image_url: clean(body.image_url, 2000), open_time_1: clean(body.open_time_1, 100), open_time_2: clean(body.open_time_2, 100),
    price: clean(body.price, 500), ticket: clean(body.ticket, 500), warning_image: clean(body.warning_image, 2000),
    warning_text: clean(body.warning_text, 5000), warning_latitude: num(body.warning_latitude), warning_longitude: num(body.warning_longitude)
  };
}

async function listPlaces(url, env) {
  const q = clean(url.searchParams.get('q'), 200);
  const country = clean(url.searchParams.get('country'), 120);
  const city = clean(url.searchParams.get('city'), 120);
  const area = clean(url.searchParams.get('area'), 160);
  const limit = clamp(url.searchParams.get('limit'), 1, 5000, 2000);
  const offset = clamp(url.searchParams.get('offset'), 0, 100000, 0);
  const clauses = [];
  const binds = [];

  if (country) { clauses.push('country=?'); binds.push(country); }
  if (city) { clauses.push('city=?'); binds.push(city); }
  if (area) { clauses.push('area=?'); binds.push(area); }
  if (q) {
    clauses.push('(name LIKE ? OR category LIKE ? OR recommend LIKE ? OR area LIKE ? OR city LIKE ?)');
    const like = `%${q}%`;
    binds.push(like, like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await env.DB.prepare(`SELECT * FROM places ${where} ORDER BY country,city,area,name LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all();
  return result.results || [];
}

async function createPlace(request, env) {
  const p = normalizePlace(await request.json());
  if (!p.name) throw new Error('name is required');

  if (p.image_url) {
    p.image_url = await importImageToR2(p.image_url, p.name, request, env);
  }

  const result = await env.DB.prepare(`
    INSERT INTO places(
      name,country,city,area,category,map_link,latitude,longitude,recommend,move_difficulty,
      road_note,image_url,open_time_1,open_time_2,price,ticket,warning_image,warning_text,warning_latitude,warning_longitude
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    p.name,p.country,p.city,p.area,p.category,p.map_link,p.latitude,p.longitude,p.recommend,p.move_difficulty,
    p.road_note,p.image_url,p.open_time_1,p.open_time_2,p.price,p.ticket,p.warning_image,p.warning_text,p.warning_latitude,p.warning_longitude
  ).run();

  return { id: result.meta.last_row_id, ...p };
}

async function updatePlace(id, request, env) {
  const p = normalizePlace(await request.json());
  if (!p.name) throw new Error('name is required');
  const existing = await env.DB.prepare('SELECT id FROM places WHERE id=?').bind(id).first();
  if (!existing) return null;

  if (p.image_url) {
    p.image_url = await importImageToR2(p.image_url, p.name, request, env);
  }

  await env.DB.prepare(`
    UPDATE places SET name=?,country=?,city=?,area=?,category=?,map_link=?,latitude=?,longitude=?,recommend=?,move_difficulty=?,
      road_note=?,image_url=?,open_time_1=?,open_time_2=?,price=?,ticket=?,warning_image=?,warning_text=?,warning_latitude=?,warning_longitude=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(
    p.name,p.country,p.city,p.area,p.category,p.map_link,p.latitude,p.longitude,p.recommend,p.move_difficulty,
    p.road_note,p.image_url,p.open_time_1,p.open_time_2,p.price,p.ticket,p.warning_image,p.warning_text,p.warning_latitude,p.warning_longitude,id
  ).run();

  return { id, ...p };
}

// =========================================================
// CSV / SHEET IMPORT
// =========================================================

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }

  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

function makeHeaders(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = clean(header, 200) || `__col_${index}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}__${count}`;
  });
}

function pick(obj, names, fallback = '') {
  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null && String(obj[name]).trim() !== '') return obj[name];
  }
  return fallback;
}

function parseCoords(value) {
  const [lat, lng] = String(value || '').split(',').map(v => Number(v.trim()));
  return { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null };
}

function inferLegacyLocation(raw, country, city, area) {
  country = clean(country, 120); city = clean(city, 120); area = clean(area, 160);
  if (country || city || area) return { country, city, area };
  const original = clean(raw, 160);
  return LEGACY_LOCATION_MAP[fold(original)] || { country: '', city: original, area: '' };
}

function normalizeLegacyPlace(obj, row) {
  const location = inferLegacyLocation(
    pick(obj, ['Khu vực','Khu Vực','Location']), pick(obj, ['Country','Quốc gia']),
    pick(obj, ['City','Thành phố','Tỉnh/Thành phố']), pick(obj, ['Area','Phân khu','Khu vực nhỏ'])
  );
  const coords = parseCoords(pick(obj, ['Vị trí','Toạ độ','Tọa độ','Coordinates']));
  const warningCoords = parseCoords(pick(obj, ['Tọa độ điểm đen','Toạ độ điểm đen','warning_coords'], row[28] || ''));

  return {
    name: clean(pick(obj, ['Tên','Tên quán','Name']), 300), country: location.country, city: location.city, area: location.area,
    category: clean(pick(obj, ['Category','Loại hình']), 300), map_link: clean(pick(obj, ['Link','Link Maps','Map Link']), 2000),
    latitude: coords.lat, longitude: coords.lng, recommend: clean(pick(obj, ['Recommend','Gợi ý','Note'])),
    move_difficulty: clean(pick(obj, ['Di chuyển','Phương tiện']), 200) || 'Dễ',
    road_note: clean(pick(obj, ['Lưu ý đường vào','Lưu ý đường']), 5000), image_url: clean(pick(obj, ['Image','Ảnh']), 2000),
    open_time_1: clean(pick(obj, ['Giờ mở cửa 1','Giờ mở cửa','Open Time','Open Time 1']), 100),
    open_time_2: clean(pick(obj, ['Giờ mở cửa 2','Giờ mở cửa__2','Open Time 2']), 100),
    price: clean(pick(obj, ['Giá/món','Giá','Price']), 500), ticket: clean(pick(obj, ['Vé','Ticket']), 500),
    warning_image: clean(pick(obj, ['Ảnh điểm đen','Warning Image'], row[26] || ''), 2000),
    warning_text: clean(pick(obj, ['Điểm đen','Traffic Warning','Warning'], row[27] || ''), 5000),
    warning_latitude: warningCoords.lat, warning_longitude: warningCoords.lng
  };
}

async function importSheet(request, env) {
  const body = await request.json().catch(() => ({}));
  const url = clean(body.url || env.LEGACY_CSV_URL || DEFAULT_CSV, 3000);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được Sheet CSV: HTTP ${response.status}`);

  const rows = parseCsv(await response.text());
  if (rows.length < 2) throw new Error('Sheet CSV không có dữ liệu.');
  const headers = makeHeaders(rows[0]);
  const places = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = row[index] || ''; });
    return normalizeLegacyPlace(obj, row);
  }).filter(place => place.name || place.warning_text);

  if (body.replace === true) await env.DB.prepare('DELETE FROM places').run();
  let inserted = 0, skipped = 0;

  for (let i = 0; i < places.length; i += 40) {
    const batch = places.slice(i, i + 40).map(p => env.DB.prepare(`
      INSERT OR IGNORE INTO places(
        name,country,city,area,category,map_link,latitude,longitude,recommend,move_difficulty,
        road_note,image_url,open_time_1,open_time_2,price,ticket,warning_image,warning_text,warning_latitude,warning_longitude
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      p.name,p.country,p.city,p.area,p.category,p.map_link,p.latitude,p.longitude,p.recommend,p.move_difficulty,
      p.road_note,p.image_url,p.open_time_1,p.open_time_2,p.price,p.ticket,p.warning_image,p.warning_text,p.warning_latitude,p.warning_longitude
    ));

    const results = await env.DB.batch(batch);
    for (const result of results) Number(result?.meta?.changes || 0) > 0 ? inserted++ : skipped++;
  }

  return { totalRows: places.length, inserted, skipped, source: url };
}

async function stats(env) {
  const places = await env.DB.prepare('SELECT COUNT(*) count FROM places').first();
  return { places: Number(places?.count || 0) };
}

// =========================================================
// AI LOCATION + D1 SEARCH
// =========================================================

function parseLegacyLocation(khuVuc) {
  const parts = clean(khuVuc, 500).split('/').map(v => v.trim()).filter(Boolean);
  if (parts.length >= 3) return { country: parts[0], city: parts[1], area: parts.slice(2).join(' / ') };
  if (parts.length === 2) return { country: '', city: parts[0], area: parts[1] };
  if (parts.length === 1) return { country: '', city: parts[0], area: '' };
  return { country: '', city: '', area: '' };
}

function normalizeUserLocation(raw, khuVuc) {
  const legacy = parseLegacyLocation(khuVuc);
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    country: clean(raw.country || legacy.country, 120),
    city: clean(raw.city || legacy.city, 120),
    area: clean(raw.area || legacy.area, 160),
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    source: clean(raw.source, 40) || 'selector'
  };
}

function stripAdminWords(value) {
  const raw = fold(value);
  const tokens = raw.split(/\s+/).filter(Boolean);
  const stripped = tokens.filter(token => !ADMIN_WORDS.has(token)).join(' ').trim();
  return stripped || raw;
}

function containsPhrase(foldedQuestion, phrase) {
  const p = fold(phrase);
  if (!p || p.length < 2) return false;
  return (` ${foldedQuestion} `).includes(` ${p} `);
}

function cityAliases(value) {
  const key = fold(value);
  const aliases = [value, stripAdminWords(value)];
  if (key.includes('hcm') || key.includes('ho chi minh')) aliases.push('HCM','TPHCM','TP HCM','Hồ Chí Minh','Ho Chi Minh','Ho Chi Minh City','Sài Gòn','Saigon');
  if (key.includes('da lat')) aliases.push('Đà Lạt','Da Lat','Dalat');
  if (key.includes('da nang')) aliases.push('Đà Nẵng','Da Nang','Danang');
  if (key.includes('vung tau')) aliases.push('Vũng Tàu','Vung Tau');
  if (key.includes('thuong hai') || key.includes('shanghai')) aliases.push('Thượng Hải','Shanghai');
  if (key.includes('trung khanh') || key.includes('chongqing')) aliases.push('Trùng Khánh','Chongqing');
  if (key.includes('phuong hoang') || key.includes('fenghuang')) aliases.push('Phượng Hoàng','Fenghuang');
  return [...new Set(aliases.map(fold).filter(Boolean))];
}

function countryAliases(value) {
  const key = fold(value);
  const aliases = [value];
  if (key.includes('viet nam') || key === 'vietnam') aliases.push('Việt Nam','Vietnam','Viet Nam','VN');
  if (key.includes('trung quoc') || key === 'china') aliases.push('Trung Quốc','China','CN');
  if (key.includes('singapore')) aliases.push('Singapore','SG');
  return [...new Set(aliases.map(fold).filter(Boolean))];
}

function areaAliases(value) {
  const raw = fold(value);
  const aliases = [raw, stripAdminWords(value)];
  const districtNumber = raw.match(/^(?:quan|district)\s*(\d+)$/);
  if (districtNumber) aliases.push(`q${districtNumber[1]}`, `quan ${districtNumber[1]}`, `district ${districtNumber[1]}`);
  return [...new Set(aliases.filter(v => v && v.length >= 2))];
}

async function loadLocationIndex(env) {
  const result = await env.DB.prepare(`SELECT country,city,area FROM places GROUP BY country,city,area`).all();
  return (result.results || []).map(row => ({
    country: clean(row.country, 120), city: clean(row.city, 120), area: clean(row.area, 160)
  }));
}

function detectQuestionLocation(userMessage, index) {
  const question = fold(userMessage);
  if (!question) return null;
  const candidates = [];

  for (const row of index) {
    if (row.area) {
      for (const alias of areaAliases(row.area)) {
        if (containsPhrase(question, alias)) candidates.push({ specificity: 3, alias, location: { country: row.country, city: row.city, area: row.area } });
      }
    }

    if (row.city) {
      for (const alias of cityAliases(row.city)) {
        if (containsPhrase(question, alias)) candidates.push({ specificity: 2, alias, location: { country: row.country, city: row.city, area: '' } });
      }
    }

    if (row.country) {
      for (const alias of countryAliases(row.country)) {
        if (containsPhrase(question, alias)) candidates.push({ specificity: 1, alias, location: { country: row.country, city: '', area: '' } });
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.specificity - a.specificity || b.alias.length - a.alias.length);
  return { ...candidates[0].location, source: 'question', matchedText: candidates[0].alias };
}

async function resolveSearchLocation(userMessage, currentLocation, env) {
  const index = await loadLocationIndex(env);
  const explicit = detectQuestionLocation(userMessage, index);
  if (explicit) return { current: currentLocation, search: explicit };

  const search = {
    country: currentLocation.country,
    city: currentLocation.city,
    area: currentLocation.area,
    source: currentLocation.source || 'selector',
    matchedText: ''
  };
  return { current: currentLocation, search };
}

function locationTokens(location) {
  return new Set(tokens([location.country, location.city, location.area].filter(Boolean).join(' ')));
}

function tokens(question) {
  return [...new Set(
    fold(question).split(/\s+/).filter(token => token.length >= 2 && !STOP_WORDS.has(token))
  )].slice(0, 40);
}

function contentTokens(question, location) {
  const loc = locationTokens(location);
  return tokens(question).filter(token => !loc.has(token) && !ADMIN_WORDS.has(token));
}

function scopeSql(location) {
  const clauses = [];
  const binds = [];
  if (location.country) { clauses.push('country=?'); binds.push(location.country); }
  if (location.city) { clauses.push('city=?'); binds.push(location.city); }
  if (location.area) { clauses.push('area=?'); binds.push(location.area); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', binds };
}

function samePlaceRegion(a, b) {
  if (!a || !b) return false;
  if (a.country && b.country && fold(a.country) !== fold(b.country)) return false;
  if (a.city && b.city && fold(a.city) !== fold(b.city)) return false;
  return true;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const R = 6371;
  const p1 = values[0] * Math.PI / 180;
  const p2 = values[2] * Math.PI / 180;
  const dLat = (values[2] - values[0]) * Math.PI / 180;
  const dLon = (values[3] - values[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearbyIntent(message) {
  const q = fold(message);
  return ['gan day','gan toi','gan tui','gan minh','quanh day','xung quanh','gan nhat','near me','nearby'].some(p => q.includes(p));
}

function isFoodModule(modules) {
  return modules.includes('CSV_AN_UONG');
}

function moduleBoostPlace(place, modules) {
  if (!isFoodModule(modules)) return 0;
  const category = fold(place.category);
  return ['an','uong','an nhe','dac san','food','restaurant','cafe'].some(v => category.includes(v)) ? 12 : 0;
}


function fieldHasAny(value, tokenList) {
  const text = fold(value);
  return tokenList.some(token => text.includes(token));
}

function placeHasNeed(place, needTokens) {
  if (!needTokens.length) return true;
  return [place.name,place.category,place.recommend,place.road_note,place.price].some(value => fieldHasAny(value, needTokens));
}


function scorePlace(place, question, tokenList, modules, distanceKm, nearbyIntent) {
  const name = fold(place.name), category = fold(place.category), recommend = fold(place.recommend), road = fold(place.road_note), price = fold(place.price);
  let score = moduleBoostPlace(place, modules);
  if (name && question.includes(name)) score += 180;
  if (category && question.includes(category)) score += 35;

  for (const token of tokenList) {
    if (name.includes(token)) score += 24;
    if (category.includes(token)) score += 18;
    if (recommend.includes(token)) score += 12;
    if (road.includes(token)) score += 5;
    if (price.includes(token)) score += 3;
  }

  if (nearbyIntent && Number.isFinite(distanceKm)) score += Math.max(0, 35 - Math.min(distanceKm, 35));
  return score;
}


async function loadD1Context(userMessage, currentLocation, matchedModules, env) {
  if (!env.DB) return { dbReady:false, places:[], currentLocation, searchLocation:currentLocation };
  try {
    const resolved = await resolveSearchLocation(userMessage, currentLocation, env);
    const searchLocation = resolved.search;
    const scope = scopeSql(searchLocation);
    const placesStmt = env.DB.prepare(`SELECT * FROM places ${scope.where} ORDER BY name LIMIT 1200`);
    const placesResult = scope.binds.length ? await placesStmt.bind(...scope.binds).all() : await placesStmt.all();
    const allPlaces = placesResult.results || [];
    const question = fold(userMessage);
    const tokenList = tokens(userMessage);
    const needTokens = contentTokens(userMessage, searchLocation);
    const nearbyIntent = isNearbyIntent(userMessage);
    const canUseGpsDistance = Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude) && samePlaceRegion(currentLocation, searchLocation);

    const rankedPlaces = allPlaces.map(place => {
      const distanceKm = canUseGpsDistance ? haversineKm(currentLocation.latitude,currentLocation.longitude,place.latitude,place.longitude) : null;
      return { place:{ ...place, _distance_km:distanceKm }, score:scorePlace(place, question, tokenList, matchedModules, distanceKm, nearbyIntent) };
    }).sort((a,b) => b.score - a.score || ((a.place._distance_km ?? Infinity) - (b.place._distance_km ?? Infinity)));

    let curatedMatches;
    if (needTokens.length) curatedMatches = rankedPlaces.filter(entry => placeHasNeed(entry.place, needTokens));
    else if (isFoodModule(matchedModules)) curatedMatches = rankedPlaces.filter(entry => moduleBoostPlace(entry.place, matchedModules) > 0);
    else curatedMatches = rankedPlaces.filter(entry => entry.score > 0);

    return {
      dbReady:true,
      places:curatedMatches.slice(0, 15).map(entry => entry.place),
      curatedMatched:curatedMatches.length > 0,
      currentLocation,
      searchLocation,
      searchLocationSource:searchLocation.source || 'selector',
      nearbyIntent
    };
  } catch (error) {
    console.error('D1 CONTEXT ERROR:', error);
    return { dbReady:false, places:[], currentLocation, searchLocation:currentLocation };
  }
}

function formatDistanceKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n < 1 ? `${Math.max(1, Math.round(n * 1000))} m` : `${n.toFixed(n < 10 ? 1 : 0)} km`;
}

function formatPlaces(rows) {
  return rows.map((p, index) => `${index + 1}. Tên: ${p.name}
Country: ${p.country}
City: ${p.city}
Area: ${p.area}
Category: ${p.category}
Link Maps: ${p.map_link}
Tọa độ: ${p.latitude ?? ''}, ${p.longitude ?? ''}
Khoảng cách từ GPS: ${formatDistanceKm(p._distance_km)}
Recommend: ${p.recommend}
Di chuyển: ${p.move_difficulty}
Lưu ý đường vào: ${p.road_note}
Giờ mở cửa: ${[p.open_time_1,p.open_time_2].filter(Boolean).join(' | ')}
Giá/món: ${p.price}
Vé: ${p.ticket}`).join('\n\n');
}


function formatLocation(location) {
  if (!location) return 'Không xác định';
  const label = [location.area, location.city, location.country].filter(Boolean).join(' / ');
  const coords = Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? ` (${location.latitude}, ${location.longitude})` : '';
  return `${label || 'Không xác định'}${coords}`;
}

function stripLegacyKnowledgeBase(rawPrompt) {
  let raw = String(rawPrompt || '');
  const gpsMarkers = ['\n[VỊ TRÍ HIỆN TẠI CỦA KHÁCH]:', '\n[HỆ THỐNG]: Hiện chưa lấy được GPS thực tế', '\n[HỆ THỐNG]: Vị trí đang chọn là'];
  let gpsIndex = -1;

  for (const marker of gpsMarkers) {
    const index = raw.lastIndexOf(marker);
    if (index > gpsIndex) gpsIndex = index;
  }

  const gps = gpsIndex >= 0 ? raw.slice(gpsIndex).trim() : '';
  let base = gpsIndex >= 0 ? raw.slice(0, gpsIndex) : raw;
  const dataMarkers = ['--- DỮ LIỆU CẨM NANG BẮT BUỘC TRONG HỆ THỐNG ---','--- DỮ LIỆU CẨM NANG CSV BẮT BUỘC TRONG HỆ THỐNG ---'];

  for (const marker of dataMarkers) {
    const index = base.indexOf(marker);
    if (index >= 0) { base = base.slice(0, index); break; }
  }

  return { base: base.trim(), gps };
}

function buildPrompt(rawPrompt, context) {
  const { base, gps } = stripLegacyKnowledgeBase(rawPrompt);
  const searchSource = context.searchLocationSource === 'question'
    ? 'Địa điểm được nêu trực tiếp trong câu hỏi, ưu tiên hơn GPS cho dữ liệu curated.'
    : 'Không có địa điểm khác trong câu hỏi, dùng vị trí hiện tại/đang chọn.';

  const sections = [
    base,
    `--- NGỮ CẢNH VỊ TRÍ TRAVEL OS ---
Vị trí hiện tại của user: ${formatLocation(context.currentLocation)}
Phạm vi đang dùng để tìm PLACES: ${formatLocation(context.searchLocation)}
Nguồn phạm vi tìm kiếm: ${searchSource}`,
    `--- LIVE SEARCH OVERRIDE - ƯU TIÊN CAO NHẤT ---
- PLACE_INTEL đã ngừng sử dụng. Bỏ qua mọi chỉ thị cũ trong prompt có nhắc PLACE_INTEL, JSON crawl hoặc việc tự quét Google Maps.
- PLACES là dữ liệu curated của TravelOS. Dùng PLACES cho quán ăn, điểm chơi và recommendation khi phù hợp.
- search_nearby_places là nguồn DUY NHẤT được phép cung cấp các địa điểm live ngoài PLACES quanh GPS hiện tại. Worker tự chọn Geoapify ngoài Trung Quốc và AMap tại Trung Quốc.
- Khi user cần nơi gần đây/gần nhất/xung quanh như nhà thuốc, bệnh viện, phòng khám, cửa hàng tiện lợi, tạp hóa, siêu thị, ATM, ngân hàng, cây xăng, công an, cứu hỏa hoặc tiện ích tương tự: gọi search_nearby_places.
- Có thể gọi search_nearby_places cho nhu cầu nearby khác nếu user rõ ràng muốn tìm POI thật quanh vị trí hiện tại.
- Không truyền hoặc tự nghĩ tọa độ cho tool. Worker tự gắn GPS thật.
- Sau khi tool trả dữ liệu, CHỈ được nhắc tới POI có trong output. Không tự thêm tên cơ sở, địa chỉ, khoảng cách, giờ mở cửa, số điện thoại hoặc rating.
- Không tự tạo link bản đồ cho kết quả live. TravelOS UI sẽ hiển thị Geoapify map ngoài Trung Quốc hoặc AMap tại Trung Quốc từ structured payload.
- Tool trả rỗng hoặc lỗi thì nói thẳng chưa tìm được dữ liệu live đã kiểm chứng. Tuyệt đối không dùng trí nhớ của model để bù địa điểm.
- Nếu không có GPS thật, nói user bật Location để dùng Nearby Search.
- Các chỉ thị trong block này ghi đè mọi luật cũ mâu thuẫn trong prompt client.`,
    `--- PLACES CURATED PHÙ HỢP ---
${formatPlaces(context.places) || 'Không có địa điểm curated nào khớp nhu cầu trong phạm vi tìm kiếm hiện tại.'}`
  ];

  if (gps) sections.push(gps);
  return sections.filter(Boolean).join('\n\n');
}

// =========================================================
// CHAT HISTORY + GEMINI
// =========================================================

function buildContents(history, userMessage) {
  const list = Array.isArray(history) ? [...history] : [];
  const current = clean(userMessage, 10000);

  while (list.length) {
    const last = list[list.length - 1];
    const role = last?.role === 'ai' || last?.role === 'model' ? 'model' : 'user';
    const content = clean(last?.content, 10000);
    if (role === 'user' && content === current) list.pop();
    else break;
  }

  const contents = [];
  const append = (role, text) => {
    text = clean(text, 10000);
    if (!text) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  };

  for (const message of list.slice(-6)) append(message?.role === 'ai' || message?.role === 'model' ? 'model' : 'user', message?.content);
  append('user', current);
  return contents;
}

const NEARBY_TOOLS = [{
  functionDeclarations:[{
    name:'search_nearby_places',
    description:'Search verified live POIs around the user current GPS. TravelOS uses Geoapify outside China and AMap inside China. Use for nearby/nearest real-world places such as pharmacy, hospital, clinic, convenience store, grocery, supermarket, ATM, bank, gas station, police, fire station, or another explicit nearby POI need. Do not use for a different city than the current GPS.',
    parameters:{
      type:'OBJECT',
      properties:{
        keyword:{ type:'STRING', description:'Short semantic place keyword, for example pharmacy, hospital, convenience store, ATM, gas station, supermarket. Use the user language or a common category name.' },
        category:{ type:'STRING', description:'Optional canonical category such as pharmacy, hospital, clinic, convenience_store, grocery_store, supermarket, atm, bank, gas_station, police, fire_station, restaurant, or cafe.' },
        types:{ type:'STRING', description:'Optional provider-specific type code. Usually leave empty unless already known.' },
        radius:{ type:'INTEGER', description:'Search radius in meters, normally 1000-5000. Maximum 50000.' },
        limit:{ type:'INTEGER', description:'Number of results requested, normally 3-8.' },
        language:{ type:'STRING', description:'Preferred language code, normally vi for Vietnam, zh for China, or en.' }
      },
      required:['keyword']
    }
  }]
}];

async function callGemini(systemPrompt, contents, env, tools = null) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  const model = clean(env.GEMINI_MODEL || DEFAULT_MODEL, 120) || DEFAULT_MODEL;
  const payload = { systemInstruction:{ parts:[{ text:systemPrompt }] }, contents };
  if (Array.isArray(tools) && tools.length) {
    payload.tools = tools;
    payload.toolConfig = { functionCallingConfig:{ mode:'AUTO' } };
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-goog-api-key':env.GEMINI_API_KEY },
    body:JSON.stringify(payload)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  return data;
}

function functionCalls(data) {
  return (data?.candidates?.[0]?.content?.parts || []).map(part => part?.functionCall).filter(Boolean);
}

function mapWorkerUrl(env) {
  return clean(env.MAP_WORKER_URL || 'https://travelos-map.kyuu2601.workers.dev', 1000).replace(/\/+$/, '');
}

async function runNearbyTool(call, currentLocation, env) {
  const lat = Number(currentLocation?.latitude);
  const lng = Number(currentLocation?.longitude);
  const args = call?.args && typeof call.args === 'object' ? call.args : {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok:false, error:'GPS_REQUIRED', message:'Không có GPS hiện tại. Không được tự đoán địa điểm.' };
  }

  const body = {
    center:{ lat, lng, coordSystem:'wgs84', country:currentLocation.country || '' },
    country:currentLocation.country || '',
    keyword:clean(args.keyword, 80),
    category:clean(args.category, 80),
    types:clean(args.types, 300),
    radius:clamp(args.radius, 100, 50000, 3000),
    limit:clamp(args.limit, 1, 8, 6),
    language:clean(args.language, 20) || (countryAliases(currentLocation.country).some(v => v.includes('trung quoc') || v === 'china' || v === 'cn') ? 'zh' : 'vi')
  };
  if (!body.keyword && !body.types) return { ok:false, error:'EMPTY_QUERY', message:'Tool thiếu keyword/types.' };

  try {
    const response = await fetch(`${mapWorkerUrl(env)}/poi/nearby`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok:false, error:'LIVE_NEARBY_ERROR', message:clean(data?.error || `HTTP ${response.status}`, 1000), query:body };
    const pois = Array.isArray(data?.pois) ? data.pois.slice(0, body.limit) : [];
    return {
      ok:true,
      source:data.source || 'live-nearby',
      provider:data.provider || '',
      query:data.query || body,
      center:data.center || body.center,
      count:pois.length,
      output:pois
    };
  } catch (error) {
    return { ok:false, error:'MAP_WORKER_UNAVAILABLE', message:clean(error?.message || 'Map Worker unavailable', 1000), query:body };
  }
}

function mergeNearbyResults(results) {
  const good = results.filter(x => x?.ok);
  if (!good.length) return null;
  const seen = new Set();
  const pois = [];
  for (const result of good) {
    for (const poi of result.output || []) {
      const key = String(poi.id || poi.poiId || `${poi.name}|${poi.lat}|${poi.lng}`);
      if (seen.has(key)) continue;
      seen.add(key); pois.push(poi);
    }
  }
  pois.sort((a,b) => (Number(a.distance) || Infinity) - (Number(b.distance) || Infinity));
  return {
    source:good[0].source || 'live-nearby',
    provider:good[0].provider || '',
    query:good.map(x => x.query?.keyword).filter(Boolean).join(' / '),
    center:good[0].center,
    pois:pois.slice(0, 8)
  };
}

async function handleAi(request, env) {
  if (!(await rateLimit(request, env))) {
    return json({ text:'⚠️ TravelOS đang nhận quá nhiều request. Fen thử lại sau khoảng 1 phút nha.', error:{ message:'Rate limit exceeded' } }, 200, request, env);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error:'Invalid JSON body' }, 400, request, env); }

  const userMessage = clean(body.userMessage, 10000);
  if (!userMessage) return json({ error:'userMessage is required' }, 400, request, env);
  const currentLocation = normalizeUserLocation(body.userLocation, body.khuVuc);
  const matchedModules = Array.isArray(body.matchedModules) ? body.matchedModules.map(v => clean(v, 100)).filter(Boolean) : [];

  try {
    const context = await loadD1Context(userMessage, currentLocation, matchedModules, env);
    const finalPrompt = buildPrompt(body.systemPrompt, context);
    const contents = buildContents(body.chatHistory, userMessage);
    const allToolResults = [];
    let result = null;

    for (let round = 0; round < 3; round++) {
      result = await callGemini(finalPrompt, contents, env, NEARBY_TOOLS);
      const calls = functionCalls(result).filter(call => call.name === 'search_nearby_places').slice(0, 3);
      if (!calls.length) break;

      const toolResults = [];
      for (const call of calls) toolResults.push(await runNearbyTool(call, currentLocation, env));
      allToolResults.push(...toolResults);

      const modelContent = result?.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);
      contents.push({
        role:'user',
        parts:calls.map((call, index) => ({ functionResponse:{ name:call.name, response:toolResults[index] } }))
      });
    }

    if (functionCalls(result).length) result = await callGemini(finalPrompt, contents, env, null);
    const nearby = mergeNearbyResults(allToolResults);
    if (nearby && result) result.travelos = { ...(result.travelos || {}), nearby };
    return json(result, 200, request, env);
  } catch (error) {
    console.error('AI ERROR:', error);
    return json({
      text:`⚠️ Thổ Địa đang gặp lỗi kết nối AI: ${clean(error?.message || 'Unknown error', 500)}. Fen thử lại sau nha.`,
      error:{ message:clean(error?.message || 'Unknown error', 1000) }
    }, 200, request, env);
  }
}

// =========================================================
// ROUTER
// =========================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: isOriginAllowed(request, env) ? 204 : 403, headers: cors(request, env) });
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && path.startsWith('/images/')) {
      const key = path.slice('/images/'.length);
      return serveR2Image(request, env, key);
    }

    if (!isOriginAllowed(request, env)) return json({ error: 'Origin not allowed' }, 403, request, env);

    if ((path === '/' || path === '/ai') && request.method === 'POST') return handleAi(request, env);
    if ((path === '/' || path === '/ai') && request.method === 'GET') return json({ ok: true, worker: 'TravelOS' }, 200, request, env);

    if (path === '/api/health' && request.method === 'GET') {
      let db = { bound: Boolean(env.DB), ready: false };
      if (env.DB) {
        try { db = { bound: true, ready: true, ...await stats(env) }; }
        catch (error) { db = { bound: true, ready: false, error: clean(error?.message, 500) }; }
      }
      return json({ ok: true, worker: 'TravelOS', db, images: { bound: Boolean(env.IMAGES) } }, 200, request, env);
    }

    if (path === '/api/places' && request.method === 'GET') {
      if (!env.DB) return json({ error: 'D1 binding DB chưa được cấu hình.' }, 503, request, env);
      try { return json({ places: await listPlaces(url, env) }, 200, request, env); }
      catch (error) { return json({ error: clean(error?.message, 1000) }, 500, request, env); }
    }

    if (path === '/api/locations' && request.method === 'GET') {
      if (!env.DB) return json({ error: 'D1 binding DB chưa được cấu hình.' }, 503, request, env);
      try {
        const result = await env.DB.prepare(`
          SELECT country,city,area,COUNT(*) count FROM places
          GROUP BY country,city,area ORDER BY country,city,area
        `).all();
        return json({ locations: result.results || [] }, 200, request, env);
      } catch (error) {
        return json({ error: clean(error?.message, 1000) }, 500, request, env);
      }
    }

    if (path === '/api/images/import' && request.method === 'POST') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try { return json({ ok: true, ...await importImageEndpoint(request, env) }, 200, request, env); }
      catch (error) { return json({ error: clean(error?.message, 1500) }, 422, request, env); }
    }

    if (path === '/api/places' && request.method === 'POST') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      if (!env.DB) return json({ error: 'D1 binding DB chưa được cấu hình.' }, 503, request, env);
      try { return json(await createPlace(request, env), 201, request, env); }
      catch (error) { return json({ error: clean(error?.message, 1000) }, 400, request, env); }
    }

    const match = path.match(/^\/api\/places\/(\d+)$/);
    const id = match ? Number(match[1]) : null;

    if (id && request.method === 'PUT') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try {
        const place = await updatePlace(id, request, env);
        return place ? json(place, 200, request, env) : json({ error: 'Place not found' }, 404, request, env);
      } catch (error) {
        return json({ error: clean(error?.message, 1000) }, 400, request, env);
      }
    }

    if (id && request.method === 'DELETE') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try {
        const existing = await env.DB.prepare('SELECT id FROM places WHERE id=?').bind(id).first();
        if (!existing) return json({ error: 'Place not found' }, 404, request, env);
        await env.DB.prepare('DELETE FROM places WHERE id=?').bind(id).run();
        return json({ ok: true, id }, 200, request, env);
      } catch (error) {
        return json({ error: clean(error?.message, 1000) }, 500, request, env);
      }
    }

    if (path === '/api/admin/migrate-images' && request.method === 'POST') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      if (!env.DB) return json({ error: 'D1 binding DB chưa được cấu hình.' }, 503, request, env);
      if (!env.IMAGES) return json({ error: 'R2 binding IMAGES chưa được cấu hình.' }, 503, request, env);
      try { return json({ ok: true, ...await migrateImages(request, env) }, 200, request, env); }
      catch (error) { return json({ error: clean(error?.message, 1500) }, 400, request, env); }
    }

    if (path === '/api/admin/setup' && request.method === 'POST') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try {
        await ensureSchema(env);
        return json({ ok: true, message: 'D1 schema ready', stats: await stats(env) }, 200, request, env);
      } catch (error) {
        return json({ error: clean(error?.message, 1500) }, 500, request, env);
      }
    }

    if (path === '/api/admin/import-sheet' && request.method === 'POST') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try {
        await ensureSchema(env);
        return json({ ok: true, ...await importSheet(request, env), stats: await stats(env) }, 200, request, env);
      } catch (error) {
        return json({ error: clean(error?.message, 1500) }, 500, request, env);
      }
    }

    if (path === '/api/admin/stats' && request.method === 'GET') {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      try { return json({ ok: true, stats: await stats(env) }, 200, request, env); }
      catch (error) { return json({ error: clean(error?.message, 1000) }, 500, request, env); }
    }

    return json({ error: 'Not found' }, 404, request, env);
  }
};
