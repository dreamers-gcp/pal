-- Face Authentication System

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Store face images and embeddings for each student
CREATE TABLE face_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  face_image BYTEA NOT NULL, -- Raw image data
  face_embedding VECTOR(128) NOT NULL, -- Face embedding for comparison
  captured_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store attendance records with face match details
CREATE TABLE face_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_request_id UUID NOT NULL REFERENCES calendar_requests(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  check_in_image BYTEA NOT NULL, -- Image captured during check-in
  check_in_embedding VECTOR(128) NOT NULL,
  match_confidence FLOAT NOT NULL, -- Confidence score 0-1
  matched BOOLEAN NOT NULL DEFAULT FALSE, -- Whether it passed threshold
  matched_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_face_profiles_student_id ON face_profiles(student_id);
CREATE INDEX idx_face_attendance_student_id ON face_attendance(student_id);
CREATE INDEX idx_face_attendance_calendar_request_id ON face_attendance(calendar_request_id);
CREATE INDEX idx_face_attendance_matched ON face_attendance(matched);
CREATE INDEX idx_face_attendance_matched_at ON face_attendance(matched_at);

-- Enable vector similarity search (pgvector extension required)
CREATE INDEX idx_face_profiles_embedding ON face_profiles USING ivfflat (face_embedding vector_cosine_ops);
CREATE INDEX idx_face_attendance_embedding ON face_attendance USING ivfflat (check_in_embedding vector_cosine_ops);

-- Row Level Security
ALTER TABLE face_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_attendance ENABLE ROW LEVEL SECURITY;

-- Students can only see their own face profile
CREATE POLICY "Students view own face profile"
  ON face_profiles FOR SELECT
  USING (auth.uid() = student_id);

-- Students can insert and update their own face profile
CREATE POLICY "Students manage own face profile"
  ON face_profiles FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own face profile"
  ON face_profiles FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Admins can view all face profiles
CREATE POLICY "Admins view all face profiles"
  ON face_profiles FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- Students can view their own attendance records
CREATE POLICY "Students view own attendance"
  ON face_attendance FOR SELECT
  USING (auth.uid() = student_id);

-- Admins can view all attendance records
CREATE POLICY "Admins view all attendance"
  ON face_attendance FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- System can insert attendance records
CREATE POLICY "Insert attendance records"
  ON face_attendance FOR INSERT
  WITH CHECK (true);
