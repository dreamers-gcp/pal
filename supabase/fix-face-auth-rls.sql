-- Fix Face Authentication RLS Policies
-- This script updates the RLS policies to allow students to enroll their own faces

-- First, drop the old restrictive policy
DROP POLICY IF EXISTS "Admins manage face profiles" ON face_profiles;

-- Create new policies that allow students to manage their own profiles
CREATE POLICY "Students manage own face profile"
  ON face_profiles FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own face profile"
  ON face_profiles FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Keep the existing view and admin policies
-- Students can view their own
-- CREATE POLICY "Students view own face profile" already exists

-- Admins can view all face profiles
DROP POLICY IF EXISTS "Admins view all face profiles" ON face_profiles;
CREATE POLICY "Admins view all face profiles"
  ON face_profiles FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
