-- =============================================================================
-- Fix: "violates check constraint sports_bookings_sport_check" (or venue_code)
-- The app sends sport/venue values from src/lib/types.ts; the DB must allow them.
-- Run once in Supabase SQL Editor (after backup if you prefer).
-- =============================================================================

-- Drop sport/venue CHECK constraints (names are the usual Postgres defaults; if
-- this errors, list names with:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conrelid = 'public.sports_bookings'::regclass AND contype = 'c';
alter table public.sports_bookings drop constraint if exists sports_bookings_sport_check;
alter table public.sports_bookings drop constraint if exists sports_bookings_venue_code_check;

-- Legacy venue codes from older schema → current single-venue codes
update public.sports_bookings
set venue_code = 'badminton_court'
where sport = 'badminton'
  and venue_code in (
    'badminton_court_1',
    'badminton_court_2',
    'badminton_court_3',
    'badminton_court_4'
  );

update public.sports_bookings
set venue_code = 'cricket_ground'
where sport = 'cricket'
  and venue_code = 'cricket_main_ground';

-- Allowed values (must match add-sports-bookings.sql + app)
alter table public.sports_bookings
  add constraint sports_bookings_sport_check
  check (
    sport in (
      'cricket',
      'badminton',
      'basketball',
      'football',
      'table_tennis',
      'lawn_tennis',
      'snooker'
    )
  );

alter table public.sports_bookings
  add constraint sports_bookings_venue_code_check
  check (
    venue_code in (
      'cricket_ground',
      'badminton_court',
      'basketball_court',
      'football_field',
      'table_tennis',
      'lawn_tennis',
      'snooker_board_1',
      'snooker_board_2'
    )
  );
