export type UserRole = "student" | "professor" | "admin";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "clarification_needed";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_group: string | null;
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
  professor_id: string;
  title: string;
  description: string | null;
  student_group_id: string;
  classroom_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  professor?: Profile;
  student_group?: StudentGroup;
  classroom?: Classroom;
}
