-- BLE mesh attendance (professor session → student face verify → relay hops).
-- Anti-fraud enforced in DB:
--   1) Relay eligibility: hop_count > 0 only if verifier_student_id is already verified in this session.
--   2) Rate limit: max N verification rows per student_id per rolling 1-minute window (all sessions).
--
-- Apply in Supabase SQL editor or `supabase db push` after review.
-- The production mobile app does not ship BLE mesh yet; re-add a native BLE stack before using this flow in-app.

-- ---------------------------------------------------------------------------
-- Constants (change via editing this function if you need different limits)
-- ---------------------------------------------------------------------------
create or replace function public.ble_mesh_max_verifications_per_minute()
returns int
language sql
immutable
as $$
  select 5;
$$;

create or replace function public.ble_mesh_max_hop_count()
returns int
language sql
immutable
as $$
  select 3;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.ble_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid not null references public.calendar_requests (id) on delete cascade,
  professor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  public_beacon_token text not null unique default encode(gen_random_bytes(8), 'hex')
);

comment on table public.ble_attendance_sessions is
  'Professor-started BLE attendance session; public_beacon_token is advertised in manufacturer data (short id).';

create index if not exists ble_attendance_sessions_event_idx
  on public.ble_attendance_sessions (calendar_event_id);

create index if not exists ble_attendance_sessions_professor_active_idx
  on public.ble_attendance_sessions (professor_id)
  where status = 'active';

create table if not exists public.ble_attendance_verifications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ble_attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  verified_at timestamptz not null default now(),
  hop_count smallint not null default 0 check (hop_count >= 0),
  verifier_student_id uuid null references public.profiles (id) on delete set null,
  device_relay_node_id text null,
  unique (session_id, student_id)
);

comment on table public.ble_attendance_verifications is
  'One row per student per BLE session; hop_count 0 = heard professor; relay hops require eligible verifier.';

comment on column public.ble_attendance_verifications.verifier_student_id is
  'Student who relayed the beacon; must already be verified in this session when hop_count > 0.';

create index if not exists ble_attendance_verifications_session_idx
  on public.ble_attendance_verifications (session_id);

create index if not exists ble_attendance_verifications_student_time_idx
  on public.ble_attendance_verifications (student_id, verified_at desc);

-- ---------------------------------------------------------------------------
-- BEFORE INSERT: rate limit + relay eligibility + hop cap
-- ---------------------------------------------------------------------------
create or replace function public.ble_attendance_verifications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cnt int;
  v_max_hop int;
  v_max_rate int;
begin
  v_max_hop := public.ble_mesh_max_hop_count();
  v_max_rate := public.ble_mesh_max_verifications_per_minute();

  if new.hop_count > v_max_hop then
    raise exception 'BLE attendance: hop_count exceeds maximum (%)', v_max_hop;
  end if;

  -- Rate limit: rolling 1 minute per student (all sessions).
  select count(*)::int into v_cnt
  from public.ble_attendance_verifications
  where student_id = new.student_id
    and verified_at > now() - interval '1 minute';

  if v_cnt >= v_max_rate then
    raise exception 'BLE attendance: rate limit — at most % verifications per minute per student', v_max_rate;
  end if;

  -- Hop 0: direct from professor beacon; must not claim a student relay.
  if new.hop_count = 0 then
    if new.verifier_student_id is not null then
      raise exception 'BLE attendance: hop_count 0 must have verifier_student_id null';
    end if;
  else
    -- Relay eligibility: verifier must already be verified in this session.
    if new.verifier_student_id is null then
      raise exception 'BLE attendance: hop_count > 0 requires verifier_student_id';
    end if;
    if not exists (
      select 1
      from public.ble_attendance_verifications v
      where v.session_id = new.session_id
        and v.student_id = new.verifier_student_id
    ) then
      raise exception 'BLE attendance: relay verifier is not verified for this session';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ble_attendance_verifications_before_insert_trigger
  on public.ble_attendance_verifications;

create trigger ble_attendance_verifications_before_insert_trigger
  before insert on public.ble_attendance_verifications
  for each row
  execute procedure public.ble_attendance_verifications_before_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ble_attendance_sessions enable row level security;
alter table public.ble_attendance_verifications enable row level security;

drop policy if exists "BLE sessions select participants" on public.ble_attendance_sessions;
create policy "BLE sessions select participants"
  on public.ble_attendance_sessions for select
  using (
    auth.uid() = professor_id
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'student'
      )
      and exists (
        select 1
        from public.calendar_requests cr
        where cr.id = calendar_event_id
          and cr.status = 'approved'
          and (
            exists (
              select 1
              from public.student_group_members sgm
              where sgm.student_id = auth.uid()
                and sgm.group_id = cr.student_group_id
            )
            or exists (
              select 1
              from public.calendar_request_groups crg
              join public.student_group_members sgm on sgm.group_id = crg.student_group_id
              where crg.calendar_request_id = cr.id
                and sgm.student_id = auth.uid()
            )
          )
      )
    )
  );

drop policy if exists "BLE sessions insert professor" on public.ble_attendance_sessions;
create policy "BLE sessions insert professor"
  on public.ble_attendance_sessions for insert
  with check (
    auth.uid() = professor_id
    and exists (
      select 1
      from public.calendar_requests cr
      where cr.id = calendar_event_id
        and cr.status = 'approved'
        and (
          cr.professor_id = auth.uid()
          or lower(trim(coalesce(cr.professor_email, ''))) = lower(trim(coalesce((select email from public.profiles where id = auth.uid()), '')))
        )
    )
  );

drop policy if exists "BLE sessions update professor" on public.ble_attendance_sessions;
create policy "BLE sessions update professor"
  on public.ble_attendance_sessions for update
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);

drop policy if exists "BLE verifications select own or professor" on public.ble_attendance_verifications;
create policy "BLE verifications select own or professor"
  on public.ble_attendance_verifications for select
  using (
    auth.uid() = student_id
    or exists (
      select 1
      from public.ble_attendance_sessions s
      where s.id = session_id
        and s.professor_id = auth.uid()
    )
  );

drop policy if exists "BLE verifications insert self active session" on public.ble_attendance_verifications;
create policy "BLE verifications insert self active session"
  on public.ble_attendance_verifications for insert
  with check (
    auth.uid() = student_id
    and exists (
      select 1
      from public.ble_attendance_sessions s
      join public.calendar_requests cr on cr.id = s.calendar_event_id
      where s.id = session_id
        and s.status = 'active'
        and cr.status = 'approved'
        and (
          exists (
            select 1
            from public.student_group_members sgm
            where sgm.student_id = auth.uid()
              and sgm.group_id = cr.student_group_id
          )
          or exists (
            select 1
            from public.calendar_request_groups crg
            join public.student_group_members sgm on sgm.group_id = crg.student_group_id
            where crg.calendar_request_id = cr.id
              and sgm.student_id = auth.uid()
          )
        )
    )
  );

grant select, insert, update on public.ble_attendance_sessions to authenticated;
grant select, insert on public.ble_attendance_verifications to authenticated;
