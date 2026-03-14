-- ============================================================
-- Make professor_id nullable & add professor_email to calendar_requests
-- This allows timetable events to be created before professors sign up.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Make professor_id nullable
ALTER TABLE public.calendar_requests
  ALTER COLUMN professor_id DROP NOT NULL;

-- 2. Add professor_email column for matching when professor_id is null
ALTER TABLE public.calendar_requests
  ADD COLUMN IF NOT EXISTS professor_email text;

-- 3. Backfill professor_email from existing rows
UPDATE public.calendar_requests cr
  SET professor_email = p.email
  FROM public.profiles p
  WHERE cr.professor_id = p.id
    AND cr.professor_email IS NULL;

-- 4. RLS: Professors can also view requests matching their email
-- (for timetable events created before they signed up)
CREATE POLICY "Professors can view requests by email"
  ON public.calendar_requests FOR SELECT USING (
    professor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Function: When a professor signs up, backfill professor_id on their calendar events
CREATE OR REPLACE FUNCTION public.backfill_professor_calendar_requests()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'professor' THEN
    UPDATE public.calendar_requests
      SET professor_id = NEW.id,
          updated_at = now()
      WHERE professor_email = NEW.email
        AND professor_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire after a new profile is created (signup)
DROP TRIGGER IF EXISTS on_professor_signup_backfill ON public.profiles;
CREATE TRIGGER on_professor_signup_backfill
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.backfill_professor_calendar_requests();
