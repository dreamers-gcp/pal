-- Keep student group assignment enrollment-driven (CSV master).
-- No student-group field is required in signup metadata.
-- Run in Supabase SQL Editor.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_mobile text;
  v_role text;
begin
  v_mobile := nullif(btrim(coalesce(new.raw_user_meta_data->>'mobile_phone', '')), '');
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');

  insert into public.profiles (id, email, full_name, role, mobile_phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_mobile
  );

  if v_role = 'student' then
    -- Student group(s) come from enrollment CSV uploaded by admin.
    perform public.assign_groups_from_enrollments(new.email);
  end if;

  return new;
end;
$$ language plpgsql security definer;
