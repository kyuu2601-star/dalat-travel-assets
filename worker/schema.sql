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

-- Curated food/place vocabulary. These are candidate signals, not verified menus.
CREATE TABLE IF NOT EXISTS food_categories (
    id TEXT PRIMARY KEY,
    label_vi TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    query_en TEXT NOT NULL DEFAULT '[]',
    query_zh TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_dishes (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES food_categories(id),
    label_vi TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    query_en TEXT NOT NULL DEFAULT '',
    query_zh TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_affinities (
    dish_id TEXT NOT NULL REFERENCES food_dishes(id),
    category_id TEXT NOT NULL REFERENCES food_categories(id),
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    PRIMARY KEY (dish_id, category_id)
);

CREATE TABLE IF NOT EXISTS venue_brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES food_categories(id),
    aliases TEXT NOT NULL DEFAULT '[]',
    countries TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_dishes_category ON food_dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_venue_brands_category ON venue_brands(category_id);
