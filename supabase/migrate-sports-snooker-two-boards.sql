-- Add snooker sport and two board venue codes. Run once on DBs that already have the six-sport schema.

alter table public.sports_bookings drop constraint if exists sports_bookings_sport_check;
alter table public.sports_bookings drop constraint if exists sports_bookings_venue_code_check;

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
