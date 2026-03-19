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
  face_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceEmbedding {
  id: string;
  student_id: string;
  photo_path: string;
  embedding: number[];
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  event_id: string;
  photo_path: string;
  similarity_score: number;
  verified: boolean;
  marked_at: string;
  student?: Profile;
  event?: CalendarRequest;
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

export type TaskKanbanStatus = "todo" | "in_progress" | "completed";

export interface StudentTask {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: TaskKanbanStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollment {
  id: string;
  student_name: string;
  email: string;
  term: string;
  subject: string;
  credits: number;
  created_at: string;
}

export interface StudentGroupMember {
  id: string;
  student_id: string;
  group_id: string;
  created_at: string;
  student_group?: StudentGroup;
}

export interface ProfessorAssignment {
  id: string;
  professor_name: string;
  email: string;
  term: string;
  subject: string;
  credits: number;
  created_at: string;
}

export type TimetableStatus = "draft" | "approved" | "rejected";

export interface GeneratedTimetable {
  id: string;
  term: string;
  start_date: string;
  end_date: string;
  max_hours_per_day: number;
  status: TimetableStatus;
  generated_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableEntry {
  id: string;
  timetable_id: string;
  professor_id: string | null;
  professor_email: string;
  subject: string;
  student_group_id: string | null;
  classroom_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  professor?: Profile;
  student_group?: StudentGroup;
  classroom?: Classroom;
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
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  professor?: Profile;
  student_group?: StudentGroup;
  student_groups?: StudentGroup[];
  classroom?: Classroom;
}
