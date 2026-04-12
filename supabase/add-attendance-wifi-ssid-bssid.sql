-- Store Wi‑Fi network context when students mark attendance from the mobile app.
-- Nullable: web clients, denied location permission, cellular-only, or unsupported OS.

alter table public.attendance_records
  add column if not exists wifi_ssid text null,
  add column if not exists wifi_bssid text null;

comment on column public.attendance_records.wifi_ssid is 'Wi‑Fi SSID snapshot at mark time (mobile; may be null).';
comment on column public.attendance_records.wifi_bssid is 'Wi‑Fi BSSID snapshot at mark time (mobile; may be null).';
