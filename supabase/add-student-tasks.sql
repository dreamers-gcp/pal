-- Student Tasks table (Eisenhower Matrix)
-- Run this in your Supabase SQL Editor

create table public.student_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  importance text not null default 'low' check (importance in ('low', 'high')),
  urgency text not null default 'low' check (urgency in ('low', 'high')),
  due_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_tasks enable row level security;

create policy "Students can view own tasks"
  on public.student_tasks for select using (auth.uid() = student_id);

create policy "Students can create own tasks"
  on public.student_tasks for insert with check (auth.uid() = student_id);

create policy "Students can update own tasks"
  on public.student_tasks for update using (auth.uid() = student_id);

create policy "Students can delete own tasks"
  on public.student_tasks for delete using (auth.uid() = student_id);
