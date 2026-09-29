CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    area TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    map_link TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL,
    recommend TEXT NOT NULL DEFAULT '',
    move_difficulty TEXT NOT NULL DEFAULT 'Dễ',
    road_note TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    open_time_1 TEXT NOT NULL DEFAULT '',
    open_time_2 TEXT NOT NULL DEFAULT '',
    price TEXT NOT NULL DEFAULT '',
    ticket TEXT NOT NULL DEFAULT '',
    warning_image TEXT NOT NULL DEFAULT '',
    warning_text TEXT NOT NULL DEFAULT '',
    warning_latitude REAL,
    warning_longitude REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_country_city_area ON places(country, city, area);
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);
