-- Migration 001: add location_exact flag
-- Run in Supabase SQL editor after the initial schema.sql

alter table listings
  add column if not exists location_exact boolean not null default false;

comment on column listings.location_exact is
  'true = coords sourced directly from listing (building-level). false = geocoded from locality string (area-level only).';
