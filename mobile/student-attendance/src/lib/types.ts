export type UserRole = "student" | "professor" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_group: string | null;
  face_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  capacity: number | null;
  created_at: string;
}

export interface StudentGroup {
  id: string;
  name: string;
  department: string | null;
  created_at: string;
}

export interface CalendarRequest {
  id: string;
  professor_id: string | null;
  professor_email: string | null;
  title: string;
  description: string | null;
  student_group_id: string;
  classroom_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  professor?: Profile;
  student_group?: StudentGroup;
  classroom?: Classroom;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  event_id: string;
  photo_path: string;
  similarity_score: number;
  verified: boolean;
  marked_at: string;
}

export interface FaceCompareResponse {
  match: boolean;
  similarity?: number;
  error?: string;
}
