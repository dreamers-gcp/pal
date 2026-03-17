-- ============================================================
-- Migrate student_tasks: Eisenhower Matrix → Kanban Board
-- Run this in your Supabase SQL Editor
-- ============================================================

-- CASE A: Table does NOT exist yet (fresh setup)
-- This creates the table with the new Kanban schema
CREATE TABLE IF NOT EXISTS public.student_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  status      text        NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('todo', 'in_progress', 'completed')),
  due_date    date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- CASE B: Table already EXISTS (migration path)
-- Step 1: Add the new status column (safe to run even if column already added)
ALTER TABLE public.student_tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'in_progress', 'completed'));

-- Step 2: Migrate existing data
--   completed=true  → status='completed'
--   completed=false → status='todo'
UPDATE public.student_tasks
SET status = CASE
  WHEN completed = true THEN 'completed'
  ELSE 'todo'
END
WHERE status = 'todo'; -- only migrate rows not yet touched

-- Step 3: Drop old columns that are no longer needed
ALTER TABLE public.student_tasks
  DROP COLUMN IF EXISTS importance,
  DROP COLUMN IF EXISTS urgency,
  DROP COLUMN IF EXISTS completed;

-- ============================================================
-- RLS Policies
-- (Skip if policies already exist — check in Supabase dashboard)
-- ============================================================
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist, then recreate cleanly
DROP POLICY IF EXISTS "Students can view own tasks"   ON public.student_tasks;
DROP POLICY IF EXISTS "Students can create own tasks" ON public.student_tasks;
DROP POLICY IF EXISTS "Students can update own tasks" ON public.student_tasks;
DROP POLICY IF EXISTS "Students can delete own tasks" ON public.student_tasks;

CREATE POLICY "Students can view own tasks"
  ON public.student_tasks FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create own tasks"
  ON public.student_tasks FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own tasks"
  ON public.student_tasks FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own tasks"
  ON public.student_tasks FOR DELETE
  USING (auth.uid() = student_id);
