import type { CalendarRequestInfraRequirements } from "./calendar-request-infra";

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
  /** 10-digit mobile (digits only); used for parcel desk matching */
  mobile_phone?: string | null;
  face_registered: boolean;
  created_at: string;
  updated_at: string;
}

export type ParcelStatus = "awaiting_pickup" | "collected";

export interface Parcel {
  id: string;
  recipient_id: string;
  mobile_snapshot: string;
  status: ParcelStatus;
  registered_by: string | null;
  notes: string | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
  recipient?: Pick<Profile, "id" | "full_name" | "email" | "role" | "mobile_phone">;
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
  /** Program the student belongs to (e.g. GMP-A, BM-C). */
  program: string;
  term: string;
  subject: string;
  /** Course credits (may be decimal, e.g. 1.5). */
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
  course_id: string;
  term: string;
  /** Matches program name (student_groups.name). */
  subject: string;
  professor: string;
  email: string;
  /** CrPoints (may be decimal, e.g. 1.5). */
  credits: number;
  preferred_slot_1: string | null;
  preferred_slot_2: string | null;
  preferred_slot_3: string | null;
  max_hours_per_day: number;
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
  event_date: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  professor?: Profile;
  student_group?: StudentGroup;
  classroom?: Classroom;
}

/** Stored on `calendar_requests.request_kind`. `class` is legacy only (treat as extra class in UI). */
export type CalendarRequestKind =
  | "guest_speaker_session"
  | "extra_class"
  | "exam"
  | "conclave"
  | "conference"
  | "student_event"
  | "faculty_meeting"
  | "class";

export interface CalendarRequest {
  id: string;
  professor_id: string | null;
  professor_email: string | null;
  title: string;
  description: string | null;
  /** Optional subject(s): JSON string array e.g. `["A","B"]`, or legacy plain string. */
  subject?: string | null;
  student_group_id: string;
  classroom_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  /** Regular class block vs exam scheduling (same admin approval flow). */
  request_kind?: CalendarRequestKind;
  status: RequestStatus;
  admin_note: string | null;
  /** Set by admin when approving (required in app on approve). */
  assigned_hall?: string | null;
  admin_spoc?: string | null;
  /** Optional infrastructure needs (jsonb). */
  infra_requirements?: CalendarRequestInfraRequirements | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  professor?: Profile;
  student_group?: StudentGroup;
  student_groups?: StudentGroup[];
  classroom?: Classroom;
}

export type GuestHouseCode = "international_centre" | "mdp_building";

/** Admin-assigned room (after approval). */
export interface GuestHouseRoomAllocation {
  guest_house: GuestHouseCode;
  room_number: string;
}

export interface GuestHouseBooking {
  id: string;
  requester_id: string | null;
  requester_email: string | null;
  guest_name: string;
  purpose: string | null;
  /** Set when admin approves; null while pending (requester does not choose). */
  guest_house: GuestHouseCode | null;
  /** Legacy single room; also first room when using allocated_rooms. */
  room_number: string | null;
  /** Number of guests (max 4 per room; admin assigns enough rooms). */
  guest_count?: number;
  /** Rooms requested (≥ ceil(guest_count/4)); student may request extra rooms. */
  requested_room_count?: number | null;
  /** Admin allocation; set on approval. */
  allocated_rooms: GuestHouseRoomAllocation[] | null;
  check_in_date: string;
  check_out_date: string;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
}

/** Campus sports; most have one venue, snooker has two boards. */
export type SportType =
  | "cricket"
  | "badminton"
  | "basketball"
  | "football"
  | "table_tennis"
  | "lawn_tennis"
  | "snooker";

export type SportsVenueCode =
  | "cricket_ground"
  | "badminton_court"
  | "basketball_court"
  | "football_field"
  | "table_tennis"
  | "lawn_tennis"
  | "snooker_board_1"
  | "snooker_board_2";

export interface SportsBooking {
  id: string;
  requester_id: string | null;
  requester_email: string | null;
  requester_role: "student" | "professor";
  sport: SportType;
  venue_code: SportsVenueCode;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
}

export interface StudentLeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Profile;
}

export type FacilityBookingType =
  | "auditorium"
  | "computer_hall"
  | "board_room"
  | "conference_room";

export interface FacilityBooking {
  id: string;
  requester_id: string | null;
  requester_email: string | null;
  requester_role: "student" | "professor";
  facility_type: FacilityBookingType;
  venue_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
}

export type MessMealPeriod = "breakfast" | "lunch" | "dinner";

export interface MessExtraRequest {
  id: string;
  student_id: string;
  meal_date: string;
  meal_period: MessMealPeriod;
  extra_guest_count: number;
  notes: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Profile;
}

export type AppointmentServiceType = "counsellor" | "doctor";

export type AppointmentProviderCode = "counsellor_1" | "doctor_1" | "doctor_2";

export interface AppointmentBooking {
  id: string;
  student_id: string;
  service_type: AppointmentServiceType;
  provider_code: AppointmentProviderCode;
  booking_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Profile;
}
