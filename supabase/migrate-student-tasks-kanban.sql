-- Upgrade EXISTING public.student_tasks → Kanban (status + sort_order).
-- Run this when add-student-tasks.sql fails with "relation already exists".

DO $$
DECLARE
  has_completed boolean;
  has_importance boolean;
  has_urgency boolean;
  has_status boolean;
BEGIN
  IF to_regclass('public.student_tasks') IS NULL THEN
    RAISE EXCEPTION 'student_tasks does not exist. Run add-student-tasks.sql on a fresh project.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_tasks' AND column_name = 'completed'
  ) INTO has_completed;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_tasks' AND column_name = 'importance'
  ) INTO has_importance;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_tasks' AND column_name = 'urgency'
  ) INTO has_urgency;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_tasks' AND column_name = 'status'
  ) INTO has_status;

  -- Already on Kanban (status present, legacy columns gone)
  IF has_status AND NOT has_completed AND NOT has_importance THEN
    RAISE NOTICE 'student_tasks is already Kanban. Ensuring index only.';
    CREATE INDEX IF NOT EXISTS student_tasks_student_status_sort_idx
      ON public.student_tasks (student_id, status, sort_order);
    RETURN;
  END IF;

  -- Add Kanban columns
  ALTER TABLE public.student_tasks
    ADD COLUMN IF NOT EXISTS status text,
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

  IF has_completed THEN
    UPDATE public.student_tasks
    SET status = CASE
      WHEN COALESCE(completed, false) THEN 'completed'
      ELSE 'todo'
    END
    WHERE status IS NULL;
  ELSE
    UPDATE public.student_tasks SET status = COALESCE(status, 'todo') WHERE status IS NULL;
  END IF;

  IF has_importance AND has_urgency THEN
    UPDATE public.student_tasks
    SET status = 'in_progress'
    WHERE status = 'todo'
      AND COALESCE(importance, '') = 'high'
      AND COALESCE(urgency, '') = 'high';
  END IF;

  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY student_id, status
        ORDER BY created_at ASC
      ) - 1 AS rn
    FROM public.student_tasks
  )
  UPDATE public.student_tasks t
  SET sort_order = ranked.rn
  FROM ranked
  WHERE t.id = ranked.id;

  ALTER TABLE public.student_tasks ALTER COLUMN status SET NOT NULL;

  ALTER TABLE public.student_tasks DROP CONSTRAINT IF EXISTS student_tasks_status_check;
  ALTER TABLE public.student_tasks
    ADD CONSTRAINT student_tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'completed'));

  ALTER TABLE public.student_tasks DROP COLUMN IF EXISTS importance;
  ALTER TABLE public.student_tasks DROP COLUMN IF EXISTS urgency;
  ALTER TABLE public.student_tasks DROP COLUMN IF EXISTS completed;

  CREATE INDEX IF NOT EXISTS student_tasks_student_status_sort_idx
    ON public.student_tasks (student_id, status, sort_order);
END $$;
