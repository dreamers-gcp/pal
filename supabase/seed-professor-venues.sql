-- Seed the classrooms table with the venue names the professor booking form expects.
-- Safe to run multiple times (skips if name already exists).
-- Run this in Supabase SQL Editor.

insert into public.classrooms (name) values
  ('Class Room'),
  ('Seminar Hall'),
  ('Exam Hall'),
  ('Computer Hall'),
  ('Board Room'),
  ('Auditorium')
on conflict (name) do nothing;
