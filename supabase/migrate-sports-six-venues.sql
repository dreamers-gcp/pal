-- Migrate existing sports_bookings to six sports / one venue each.
-- Run after backup. Safe to run once.

-- 1) Drop old CHECK constraints (Postgres default names from table creation)
alter table public.sports_bookings drop constraint if exists sports_bookings_sport_check;
alter table public.sports_bookings drop constraint if exists sports_bookings_venue_code_check;

-- 2) Map legacy venue codes to the single venue per sport
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

-- 3) New allowed values
alter table public.sports_bookings
  add constraint sports_bookings_sport_check
  check (
    sport in (
      'cricket',
      'badminton',
      'basketball',
      'football',
      'table_tennis',
      'lawn_tennis'
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
      'lawn_tennis'
    )
  );
