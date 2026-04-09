-- Remove professor class-photo scan feature (storage only + optional row cleanup).
-- App change: class-photo API and professor upload/camera UI were removed; professors only use
-- Mark Present / Mark Absent (manual-override paths).
--
-- After running this file, re-run the full:
--   supabase/fix-attendance-records-rls-eligibility.sql
-- so professor INSERT requires manual-override/ paths and professor UPDATE exists for upsert.

-- 1) Storage: drop policies that allowed professor uploads under face-photos/class-photo/...
drop policy if exists "Professors upload class attendance photos" on storage.objects;
drop policy if exists "Professors read class attendance photos" on storage.objects;

-- 2) Optional cleanup: rows from the old bulk class-photo apply (shared storage path).
-- Uncomment to delete those attendance rows:
-- delete from public.attendance_records where photo_path like 'class-photo/%';
--
-- Optional: remove objects under class-photo/ in Dashboard → Storage → face-photos.
