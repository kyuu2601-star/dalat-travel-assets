const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function corsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
    const allowOrigin = allowed.includes(origin) ? origin : (allowed.length ? allowed[0] : '*');
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Vary': 'Origin'
    };
}

function json(data, status, request, env) {
    return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...corsHeaders(request, env) } });
}

function cleanString(value) {
    return value == null ? '' : String(value).trim();
}

function cleanNumber(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeInput(body) {
    return {
        name: cleanString(body.name),
        country: cleanString(body.country),
        city: cleanString(body.city),
        area: cleanString(body.area),
        category: cleanString(body.category),
        map_link: cleanString(body.map_link),
        latitude: cleanNumber(body.latitude),
        longitude: cleanNumber(body.longitude),
        recommend: cleanString(body.recommend),
        move_difficulty: cleanString(body.move_difficulty) || 'Dễ',
        road_note: cleanString(body.road_note),
        image_url: cleanString(body.image_url),
        open_time_1: cleanString(body.open_time_1),
        open_time_2: cleanString(body.open_time_2),
        price: cleanString(body.price),
        ticket: cleanString(body.ticket),
        warning_image: cleanString(body.warning_image),
        warning_text: cleanString(body.warning_text),
        warning_latitude: cleanNumber(body.warning_latitude),
        warning_longitude: cleanNumber(body.warning_longitude)
    };
}

async function listPlaces(env) {
    const result = await env.DB.prepare('SELECT * FROM places ORDER BY country, city, area, name').all();
    return result.results || [];
}

async function createPlace(request, env) {
    const body = normalizeInput(await request.json());
    if (!body.name) return { error: 'name is required', status: 400 };

    const stmt = env.DB.prepare(`
        INSERT INTO places (
            name,country,city,area,category,map_link,latitude,longitude,recommend,
            move_difficulty,road_note,image_url,open_time_1,open_time_2,price,ticket,
            warning_image,warning_text,warning_latitude,warning_longitude
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
        body.name, body.country, body.city, body.area, body.category, body.map_link,
        body.latitude, body.longitude, body.recommend, body.move_difficulty, body.road_note,
        body.image_url, body.open_time_1, body.open_time_2, body.price, body.ticket,
        body.warning_image, body.warning_text, body.warning_latitude, body.warning_longitude
    );
    const result = await stmt.run();
    return { place: { id: result.meta.last_row_id, ...body }, status: 201 };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const headers = corsHeaders(request, env);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
        if (url.pathname === '/api/health') return json({ ok: true }, 200, request, env);
        if (url.pathname === '/api/places' && request.method === 'GET') return json({ places: await listPlaces(env) }, 200, request, env);
        if (url.pathname === '/api/places' && request.method === 'POST') {
            try {
                const result = await createPlace(request, env);
                if (result.error) return json({ error: result.error }, result.status, request, env);
                return json(result.place, result.status, request, env);
            } catch (error) {
                return json({ error: error.message || 'Invalid request' }, 400, request, env);
            }
        }
        return json({ error: 'Not found' }, 404, request, env);
    }
};
