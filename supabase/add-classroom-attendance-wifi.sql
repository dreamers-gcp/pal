-- Expected Wi‑Fi for each room; students must match (with face) when either value is set.
-- Leave both NULL on a classroom to skip Wi‑Fi checks for events in that room.

alter table public.classrooms
  add column if not exists attendance_wifi_ssid text null,
  add column if not exists attendance_wifi_bssid text null;

comment on column public.classrooms.attendance_wifi_ssid is
  'When set, student attendance SSID must match (case-insensitive trim).';
comment on column public.classrooms.attendance_wifi_bssid is
  'When set, student attendance BSSID must match after MAC normalization.';

-- Strip to hex digits for comparison (handles aa:bb:cc vs AA-BB-CC).
create or replace function public.normalize_attendance_bssid(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null or btrim(p) = '' then null
    else
      regexp_replace(
        regexp_replace(lower(replace(btrim(p), '-', ':')), '[^a-f0-9:]', '', 'g'),
        ':',
        '',
        'g'
      )
  end;
$$;

create or replace function public.attendance_enforce_classroom_wifi()
returns trigger
language plpgsql
as $$
declare
  cid uuid;
  c_ssid text;
  c_bssid text;
  st_ssid text;
  st_bssid text;
begin
  -- Professor manual present/absent overrides (no Wi‑Fi capture).
  if new.photo_path is not null and (
    new.photo_path like 'manual-override/%'
    or new.photo_path like 'manual-override-absent/%'
  ) then
    return new;
  end if;

  select cr.classroom_id, c.attendance_wifi_ssid, c.attendance_wifi_bssid
  into cid, c_ssid, c_bssid
  from public.calendar_requests cr
  left join public.classrooms c on c.id = cr.classroom_id
  where cr.id = new.event_id;

  if cid is null then
    return new;
  end if;

  -- No expected Wi‑Fi configured: face-only (legacy).
  if (c_ssid is null or btrim(c_ssid) = '')
     and (c_bssid is null or btrim(c_bssid) = '') then
    return new;
  end if;

  st_ssid := nullif(btrim(coalesce(new.wifi_ssid, '')), '');
  st_bssid := nullif(btrim(coalesce(new.wifi_bssid, '')), '');

  if c_ssid is not null and btrim(c_ssid) <> '' then
    if st_ssid is null or lower(st_ssid) <> lower(btrim(c_ssid)) then
      raise exception 'Wi-Fi network (SSID) does not match this classroom.'
        using errcode = 'check_violation';
    end if;
  end if;

  if c_bssid is not null and btrim(c_bssid) <> '' then
    if public.normalize_attendance_bssid(st_bssid)
       is distinct from public.normalize_attendance_bssid(c_bssid) then
      raise exception 'Wi-Fi access point (BSSID) does not match this classroom.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_records_enforce_classroom_wifi on public.attendance_records;

create trigger attendance_records_enforce_classroom_wifi
  before insert on public.attendance_records
  for each row
  execute function public.attendance_enforce_classroom_wifi();
