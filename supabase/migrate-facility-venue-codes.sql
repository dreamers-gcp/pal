-- Optional one-time migration: map old facility_bookings venue_code values to new codes
-- (no underscores). Run only if you already have rows with main / conf_a / conf_b.

update public.facility_bookings
set venue_code = 'auditorium1', updated_at = now()
where facility_type = 'auditorium' and venue_code = 'main';

update public.facility_bookings
set venue_code = 'computerhall1', updated_at = now()
where facility_type = 'computer_hall' and venue_code = 'main';

update public.facility_bookings
set venue_code = 'boardroom1', updated_at = now()
where facility_type = 'board_room' and venue_code = 'main';

update public.facility_bookings
set venue_code = 'conferencehall1', updated_at = now()
where facility_type = 'conference_room' and venue_code = 'conf_a';

update public.facility_bookings
set venue_code = 'conferencehall2', updated_at = now()
where facility_type = 'conference_room' and venue_code = 'conf_b';
