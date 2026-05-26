-- ============================================================
-- Maps for Flats — Supabase Schema
-- Run this in your Supabase project's SQL editor
-- ============================================================

-- Enable PostGIS for geospatial queries (optional but useful)
-- create extension if not exists postgis;

-- ─── Listings ───────────────────────────────────────────────
create table if not exists listings (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('magicbricks', '99acres', 'housing', 'nobroker')),
  source_id       text not null,
  url             text not null,
  title           text not null,
  listing_type    text not null check (listing_type in ('rent', 'buy')),
  property_type   text not null check (property_type in ('flat', 'house', 'villa', 'plot', 'pg')),
  price           numeric not null,
  price_unit      text not null check (price_unit in ('total', 'per_month')),
  area_sqft       numeric,
  bhk             integer,
  furnishing      text check (furnishing in ('furnished', 'semi-furnished', 'unfurnished')),
  floor           integer,
  total_floors    integer,
  locality        text not null,
  city            text not null default 'Mumbai',
  lat             double precision not null,
  lng             double precision not null,
  images          text[] default '{}',
  floor_plan_images text[] default '{}',
  amenities       text[] default '{}',
  description     text,
  broker_name     text,
  location_exact  boolean not null default false,
  scraped_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  unique (source, source_id)
);

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists listings_listing_type_idx on listings (listing_type);
create index if not exists listings_property_type_idx on listings (property_type);
create index if not exists listings_bhk_idx on listings (bhk);
create index if not exists listings_price_idx on listings (price);
create index if not exists listings_locality_idx on listings (locality);
create index if not exists listings_source_idx on listings (source);
create index if not exists listings_lat_lng_idx on listings (lat, lng);
create index if not exists listings_scraped_at_idx on listings (scraped_at desc);

-- ─── Row Level Security ──────────────────────────────────────
alter table listings enable row level security;

-- Public read
create policy "listings_public_read" on listings
  for select using (true);

-- Only service role can insert/update/delete
create policy "listings_service_write" on listings
  for all using (auth.role() = 'service_role');

-- ─── Scrape Log ──────────────────────────────────────────────
create table if not exists scrape_log (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  count       integer default 0,
  errors      integer default 0,
  status      text check (status in ('running', 'done', 'failed')) default 'running'
);

alter table scrape_log enable row level security;

create policy "scrape_log_public_read" on scrape_log
  for select using (true);

create policy "scrape_log_service_write" on scrape_log
  for all using (auth.role() = 'service_role');

-- ─── Helpful view: listings summary per locality ─────────────
create or replace view locality_summary as
  select
    locality,
    listing_type,
    count(*) as total,
    round(avg(price)) as avg_price,
    min(price) as min_price,
    max(price) as max_price,
    round(avg(area_sqft)) as avg_area_sqft
  from listings
  group by locality, listing_type;
