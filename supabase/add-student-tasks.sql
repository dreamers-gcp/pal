-- =============================================================================
-- NEW Supabase projects ONLY (empty database, no student_tasks yet).
--
-- If you get: "relation student_tasks already exists"
--   → Do NOT run this file. Your table is already there.
--   → Run instead: migrate-student-tasks-kanban.sql
--      (upgrades old Eisenhower table → Kanban columns)
-- =============================================================================

create table public.student_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'completed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_tasks_student_status_sort_idx
  on public.student_tasks (student_id, status, sort_order);

alter table public.student_tasks enable row level security;

create policy "Students can view own tasks"
  on public.student_tasks for select using (auth.uid() = student_id);

create policy "Students can create own tasks"
  on public.student_tasks for insert with check (auth.uid() = student_id);

create policy "Students can update own tasks"
  on public.student_tasks for update using (auth.uid() = student_id);

create policy "Students can delete own tasks"
  on public.student_tasks for delete using (auth.uid() = student_id);
