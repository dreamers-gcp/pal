export type UserRole = "student" | "professor" | "admin";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "clarification_needed";

export type CalendarRequestKind =
  | "guest_speaker_session"
  | "extra_class"
  | "exam"
  | "conclave"
  | "conference"
  | "student_event"
  | "faculty_meeting"
  | "class";

/** Infrastructure requirements for calendar requests. */
export interface CalendarRequestInfraRequirements {
  mic_count?: number;
  sofa_count?: number;
  video_recording?: boolean;
  photography?: boolean;
  stage?: boolean;
  momento_count?: number;
  bouquet_count?: number;
}

/** Super-admin routing: which dashboard sections an admin email may open (mobile + web). */
export interface AdminRequestRouting {
  id: string;
  admin_email: string;
  request_type_key: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_group: string | null;
  mobile_phone?: string | null;
  face_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentGroup {
  id: string;
  name: string;
}

export interface Classroom {
  id: string;
  name: string;
}

export interface CalendarRequest {
  id: string;
  professor_id: string | null;
  professor_email: string | null;
  title: string;
  description: string | null;
  subject?: string | null;
  student_group_id: string;
  classroom_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  request_kind?: CalendarRequestKind;
  status: RequestStatus;
  admin_note: string | null;
  assigned_hall?: string | null;
  admin_spoc?: string | null;
  infra_requirements?: CalendarRequestInfraRequirements | null;
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  professor?: Profile;
  student_group?: StudentGroup;
  student_groups?: StudentGroup[];
  classroom?: Classroom;
}

export interface GuestHouseBookingRow {
  guest_house: string | null;
  room_number: string | null;
  allocated_rooms: unknown;
  check_in_date: string;
  check_out_date: string;
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
  /** Wi‑Fi SSID when marking from mobile (nullable). */
  wifi_ssid?: string | null;
  /** Wi‑Fi BSSID when marking from mobile (nullable). */
  wifi_bssid?: string | null;
}

export type ParcelStatus = "awaiting_pickup" | "collected";

/** Joined on admin parcel list (`profiles!parcels_recipient_id_fkey`). */
export type ParcelRecipientPreview = Pick<
  Profile,
  "id" | "full_name" | "email" | "role" | "mobile_phone"
>;

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
  recipient?: ParcelRecipientPreview;
}

export type GuestHouseCode = "international_centre" | "mdp_building";

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
  guest_house: GuestHouseCode | null;
  room_number: string | null;
  guest_count?: number;
  requested_room_count?: number | null;
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
