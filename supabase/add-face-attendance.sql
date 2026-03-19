-- Face-based attendance system
-- Run in Supabase SQL Editor

-- 1. Storage bucket for face photos
insert into storage.buckets (id, name, public) values ('face-photos', 'face-photos', false)
on conflict (id) do nothing;

-- RLS: students can upload/read their own photos; admins can read all
create policy "Students upload own face photos"
  on storage.objects for insert with check (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Students read own face photos"
  on storage.objects for select using (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Students delete own face photos"
  on storage.objects for delete using (
    bucket_id = 'face-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Admins read all face photos"
  on storage.objects for select using (
    bucket_id = 'face-photos'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Face embeddings (512-dim float vector from InsightFace)
create table public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  photo_path text not null,
  embedding float8[] not null,
  created_at timestamptz not null default now()
);

create index face_embeddings_student_idx on public.face_embeddings(student_id);

alter table public.face_embeddings enable row level security;

create policy "Students can view own embeddings"
  on public.face_embeddings for select using (auth.uid() = student_id);

create policy "Students can insert own embeddings"
  on public.face_embeddings for insert with check (auth.uid() = student_id);

create policy "Students can delete own embeddings"
  on public.face_embeddings for delete using (auth.uid() = student_id);

create policy "Admins can view all embeddings"
  on public.face_embeddings for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Professors can view student embeddings"
  on public.face_embeddings for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'professor')
  );

-- 3. Attendance records
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.calendar_requests(id) on delete cascade,
  photo_path text not null,
  similarity_score float8 not null,
  verified boolean not null default false,
  marked_at timestamptz not null default now(),
  constraint attendance_unique unique (student_id, event_id)
);

create index attendance_student_idx on public.attendance_records(student_id);
create index attendance_event_idx on public.attendance_records(event_id);

alter table public.attendance_records enable row level security;

create policy "Students can view own attendance"
  on public.attendance_records for select using (auth.uid() = student_id);

create policy "Students can mark own attendance"
  on public.attendance_records for insert with check (auth.uid() = student_id);

create policy "Professors can view attendance for their events"
  on public.attendance_records for select using (
    exists (
      select 1 from public.calendar_requests cr
      where cr.id = event_id
        and (cr.professor_id = auth.uid() or cr.professor_email = (
          select email from public.profiles where id = auth.uid()
        ))
    )
  );

create policy "Admins can view all attendance"
  on public.attendance_records for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Track whether student has completed face registration
alter table public.profiles
  add column if not exists face_registered boolean not null default false;
