export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VerificationStatus = "pending" | "verified" | "suspended";
export type AccountStatus = "active" | "suspended";
export type MembershipStatus = "active" | "inactive";
export type AppRole = "student" | "pe_admin" | "event_organizer";
export type AttendanceSessionStatus = "draft" | "open" | "closed" | "finalised";
export type AttendanceStatus =
  | "not_submitted"
  | "pending"
  | "present"
  | "represented"
  | "absent"
  | "excused";
export type AttendanceSubmissionType = "attended" | "represented";
export type TaskStatus = "draft" | "published" | "closed" | "archived";
export type TaskSubmissionStatus =
  | "pending"
  | "submitted"
  | "reviewed"
  | "needs_correction"
  | "completed";
export type AudienceType =
  | "all_students"
  | "active_pe"
  | "department"
  | "semester"
  | "selected_students";
export type QrType =
  | "visitor_entrance"
  | "playing_room"
  | "gym_room"
  | "mental_games_room"
  | "equipment";

/* ------------------------------- Phase 3 -------------------------------- */

export type EquipmentTrackingMode = "individual" | "bulk";
export type EquipmentCondition = "excellent" | "good" | "fair" | "poor" | "unusable";
export type EquipmentInventoryStatus =
  | "available"
  | "partially_available"
  | "fully_borrowed"
  | "under_maintenance"
  | "damaged"
  | "retired"
  | "unavailable";
export type EquipmentTransactionStatus =
  | "issued"
  | "partially_returned"
  | "returned"
  | "overdue"
  | "lost"
  | "damaged"
  | "cancelled";
export type EquipmentMaintenanceStatus =
  | "reported"
  | "under_review"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "unrepairable"
  | "cancelled";
export type CalendarCategory =
  | "pe_class"
  | "sports_practice"
  | "competition"
  | "fitness_activity"
  | "department_activity"
  | "announcement"
  | "deadline"
  | "other";
export type CalendarVisibility = "public" | "authenticated" | "pe_only";
export type CalendarStatus = "draft" | "published" | "archived";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";
export type FeedbackCategory =
  | "suggestion"
  | "complaint"
  | "equipment_request"
  | "equipment_damage"
  | "facility_issue"
  | "sports_activity_request"
  | "attendance_correction"
  | "other";
export type FeedbackStatus =
  | "submitted"
  | "under_review"
  | "in_progress"
  | "waiting_for_student"
  | "resolved"
  | "rejected"
  | "closed";
export type FeedbackPriority = "low" | "normal" | "high" | "urgent";
export type GameRuleStatus = "draft" | "published" | "archived";
export type GameRuleBlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "image_gallery"
  | "bullet_list"
  | "numbered_instructions"
  | "rules_section"
  | "quote"
  | "video_embed"
  | "resource";
export type Phase3AudienceType = AudienceType | "group";
export type NotificationCategory =
  | "general"
  | "attendance"
  | "task"
  | "calendar"
  | "feedback"
  | "equipment"
  | "announcement"
  | "achievement"
  | "future_event";
export type NotificationChannel = "in_app" | "email";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type EmailAnnouncementStatus = "draft" | "queued" | "sending" | "completed" | "failed";
export type EmailRecipientStatus =
  | "queued"
  | "sending"
  | "accepted"
  | "delivered"
  | "failed"
  | "bounced";
export type AchievementVerificationStatus = "pending" | "verified" | "rejected";
export type Phase3ParentType =
  | "equipment_image"
  | "maintenance_photo"
  | "feedback_attachment"
  | "calendar_attachment"
  | "game_rule_image"
  | "game_rule_document"
  | "achievement_evidence"
  | "announcement_attachment"
  | "sports_profile_photo";

/* ------------------------------- Phase 4 -------------------------------- */

export type Phase4EventStatus =
  | "draft" | "published" | "registration_open" | "registration_closed"
  | "ongoing" | "completed" | "archived";
export type Phase4EntryStatus =
  | "draft" | "submitted" | "under_review" | "approved" | "rejected"
  | "waitlisted" | "withdrawn";
export type Phase4PaymentStatus =
  | "not_required" | "pending_verification" | "verified" | "rejected"
  | "waived" | "refunded";
export type Phase4MatchStatus =
  | "scheduled" | "ready" | "ongoing" | "result_submitted" | "completed"
  | "postponed" | "cancelled" | "disputed";

export type Phase4EventRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_file_id: string | null;
  logo_file_id: string | null;
  academic_year: string;
  starts_on: string | null;
  ends_on: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  venue: string | null;
  instructions: string | null;
  contact_information: string | null;
  is_public: boolean;
  status: Phase4EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4SportRow = {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_file_id: string | null;
  category: string | null;
  mode: "team" | "individual";
  venue: string | null;
  registration_start: string | null;
  registration_deadline: string | null;
  competition_date: string | null;
  max_entries: number | null;
  is_public: boolean;
  status: Phase4EventStatus;
  scoring_mode: "simple" | "sets" | "time" | "manual";
  tournament_format: "knockout" | "round_robin" | "group_knockout";
  draw_mode: "random" | "seeded" | "manual";
  third_place: boolean;
  group_count: number | null;
  qualifiers_per_group: number | null;
  legs: number;
  points: Json;
  auto_advance: boolean;
  organizer_results_require_approval: boolean;
  draw_locked: boolean;
  started_at: string | null;
  registration_rule_snapshot: Json;
  created_at: string;
  updated_at: string;
};

export type Phase4RulesRow = {
  id: string;
  competition_id: string;
  team_name_required: boolean;
  min_team_size: number | null;
  max_team_size: number | null;
  team_limit: number | null;
  captain_required: boolean;
  substitute_allowance: number;
  allow_multiple_competitions: boolean;
  allow_duplicate_player_other_team: boolean;
  require_member_confirmation: boolean;
  require_manual_identity_verification: boolean;
  required_participant_fields: string[];
  custom_questions: Json;
  public_rules: string | null;
  eligibility_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4EligibilityRow = {
  id: string;
  competition_id: string;
  rule_type: "department" | "semester" | "academic_year" | "min_weight" | "max_weight" | "custom";
  rule_value: Json;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase4EntryRow = {
  id: string;
  competition_id: string;
  kind: "team" | "individual";
  team_name: string | null;
  captain_user_id: string | null;
  captain_directory_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: Phase4EntryStatus;
  payment_status: Phase4PaymentStatus;
  seed: number | null;
  rules_snapshot: Json;
  answers: Json;
  metadata: Json;
  rejection_reason: string | null;
  correction_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4MemberRow = {
  id: string;
  entry_id: string;
  student_directory_id: string;
  user_id: string | null;
  full_name: string;
  usn: string;
  department_id: string | null;
  semester: number | null;
  academic_year: number | null;
  weight_kg: number | null;
  is_captain: boolean;
  is_substitute: boolean;
  confirmation_status: "pending" | "accepted" | "declined" | "verified";
  confirmed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type Phase4PaymentSettingsRow = {
  id: string;
  competition_id: string;
  is_required: boolean;
  fee_amount: number | null;
  payment_unit: "team" | "participant";
  instructions: string | null;
  qr_file_id: string | null;
  payment_deadline: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4PaymentRecordRow = {
  id: string;
  entry_id: string;
  proof_file_id: string | null;
  transaction_reference: string | null;
  claimed_amount: number | null;
  status: Phase4PaymentStatus;
  note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4DrawRow = {
  id: string;
  competition_id: string;
  format: "knockout" | "round_robin" | "group_knockout";
  draw_mode: "random" | "seeded" | "manual";
  draw_seed: number;
  version: number;
  status: "draft" | "active" | "locked" | "archived";
  payload: Json;
  generated_by: string | null;
  generated_at: string;
  locked_at: string | null;
  locked_by: string | null;
  lock_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4MatchRow = {
  id: string;
  draw_id: string;
  stage_id: string | null;
  group_id: string | null;
  round_key: string;
  round_name: string;
  round_number: number;
  match_number: number;
  status: Phase4MatchStatus;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  organizer_id: string | null;
  winner_entry_id: string | null;
  is_bye: boolean;
  notes: string | null;
  calendar_event_id: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase4SlotRow = {
  match_id: string;
  slot: "a" | "b";
  entry_id: string | null;
  participant_id: string | null;
  source_match_id: string | null;
  from_bye: boolean;
};

export type Phase4ResultRow = {
  id: string;
  match_id: string;
  score_a: number | null;
  score_b: number | null;
  breakdown: Json;
  winner_entry_id: string | null;
  result_note: string | null;
  submitted_by: string | null;
  submitted_at: string;
  is_authoritative: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase4StandingRow = {
  id: string;
  draw_id: string;
  group_id: string | null;
  group_key: string;
  entry_id: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points_for: number;
  points_against: number;
  point_difference: number;
  competition_points: number;
  qualified: boolean;
  updated_at: string;
};

export type Phase4AssignmentRow = {
  id: string;
  competition_id: string;
  user_id: string;
  student_directory_id: string | null;
  assigned_by: string | null;
  status: "active" | "revoked";
  can_submit_results: boolean;
  created_at: string;
  revoked_at: string | null;
};

export type Phase4InvitationRow = {
  id: string;
  competition_id: string;
  student_directory_id: string;
  token_hash: string;
  assigned_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type Phase4FileRow = {
  id: string;
  object_key: string;
  bucket: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  uploader_id: string | null;
  parent_type: "event_banner" | "event_logo" | "sport_image" | "payment_qr" | "payment_proof" | "team_document" | "participant_document";
  parent_id: string;
  visibility: "private" | "public";
  upload_status: "pending" | "confirmed" | "failed";
  sha256: string | null;
  created_at: string;
  updated_at: string;
};

/* ------------------------------- Phase 5 -------------------------------- */

export type Phase5GameSlug =
  | "chess" | "carrom" | "tic-tac-toe" | "connect-four" | "penalty-shootout" | "basketball";
export type Phase5MatchMode = "practice" | "friendly" | "ranked";
export type Phase5MatchStatus =
  | "waiting" | "countdown" | "active" | "completed" | "cancelled" | "abandoned" | "disputed";
export type Phase5ChallengeStatus =
  | "pending" | "accepted" | "rejected" | "cancelled" | "expired" | "match_created";

export type Phase5GameRow = {
  slug: Phase5GameSlug;
  name: string;
  short_name: string;
  tagline: string;
  description: string;
  instructions: string;
  rules: Json;
  category: string;
  accent: string;
  sort_order: number;
  is_enabled: boolean;
  guest_enabled: boolean;
  competitive_enabled: boolean;
  challenge_enabled: boolean;
  practice_enabled: boolean;
  leaderboard_visible: boolean;
  maintenance_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase5GameSettingsRow = {
  game_slug: Phase5GameSlug;
  starting_rating: number;
  k_factor: number;
  chess_time_controls: Json;
  default_time_control: string;
  default_attempts: number;
  penalty_attempts: number;
  queen_value: number;
  coin_value: number;
  sudden_death: boolean;
  challenge_expiry_minutes: number;
  challenge_rate_limit: number;
  reconnection_grace_minutes: number;
  season_key: string;
  season_label: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase5GamingProfileRow = {
  user_id: string;
  gaming_name: string;
  gaming_name_key: string;
  visibility: "private" | "public";
  searchable: boolean;
  challenges_enabled: boolean;
  allowed_challengers: string[];
  bio: string | null;
  is_moderated: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase5RatingRow = {
  user_id: string;
  game_slug: Phase5GameSlug;
  season_key: string;
  rating: number;
  highest_rating: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase5RatingHistoryRow = {
  id: string;
  user_id: string;
  game_slug: Phase5GameSlug;
  match_id: string | null;
  season_key: string;
  before_rating: number;
  after_rating: number;
  delta: number;
  outcome: "win" | "loss" | "draw";
  reason: string;
  created_at: string;
};

export type Phase5ChallengeRow = {
  id: string;
  game_slug: Phase5GameSlug;
  challenger_id: string;
  opponent_id: string;
  status: Phase5ChallengeStatus;
  settings: Json;
  message: string | null;
  expires_at: string;
  responded_at: string | null;
  match_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase5MatchRow = {
  id: string;
  public_id: string;
  game_slug: Phase5GameSlug;
  mode: Phase5MatchMode;
  status: Phase5MatchStatus;
  config: Json;
  state: Json;
  version: number;
  server_seq: number;
  outcome: Json | null;
  challenge_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase5MatchPlayerRow = {
  match_id: string;
  player_index: number;
  user_id: string | null;
  display_name: string;
  ready: boolean;
  connected: boolean;
  rating_before: number | null;
  rating_after: number | null;
  rating_delta: number | null;
  joined_at: string;
};

export type Phase5ActionRow = {
  id: number;
  match_id: string;
  player_index: number;
  seq: number;
  expected_version: number;
  action_type: string;
  payload: Json;
  created_at: string;
};

export type Phase5ResultRow = {
  match_id: string;
  game_slug: Phase5GameSlug;
  mode: Phase5MatchMode;
  winner_index: number | null;
  outcome: Json;
  rating_applied: boolean;
  created_at: string;
};

type Phase4Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Phase3Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Phase5Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Phase3FileRow = {
  id: string;
  object_key: string;
  bucket: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  uploader_id: string | null;
  parent_type: Phase3ParentType;
  parent_id: string;
  visibility: "private" | "public";
  upload_status: "pending" | "confirmed" | "failed";
  sha256: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3StudentGroupRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3EquipmentCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase3EquipmentItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  identification_number: string | null;
  tracking_mode: EquipmentTrackingMode;
  quantity: number;
  available_quantity: number;
  borrowed_quantity: number;
  maintenance_quantity: number;
  damaged_quantity: number;
  retired_quantity: number;
  condition: EquipmentCondition;
  storage_location: string | null;
  purchased_on: string | null;
  useful_life_months: number | null;
  notes: string | null;
  image_file_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase3EquipmentAssetRow = {
  id: string;
  item_id: string;
  asset_tag: string;
  serial_number: string | null;
  condition: EquipmentCondition;
  status: "available" | "borrowed" | "under_maintenance" | "damaged" | "retired" | "unavailable";
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3EquipmentTransactionRow = {
  id: string;
  item_id: string;
  asset_id: string | null;
  student_directory_id: string;
  quantity_issued: number;
  quantity_returned: number;
  issued_at: string;
  expected_return_at: string;
  issued_by: string | null;
  issue_condition: EquipmentCondition;
  notes: string | null;
  status: EquipmentTransactionStatus;
  returned_at: string | null;
  received_by: string | null;
  return_condition: EquipmentCondition | null;
  damage_indicator: boolean;
  return_notes: string | null;
  correction_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3EquipmentReturnRow = {
  id: string;
  transaction_id: string;
  quantity: number;
  condition: EquipmentCondition;
  damage_indicator: boolean;
  notes: string | null;
  received_by: string | null;
  returned_at: string;
};

export type Phase3MaintenanceRow = {
  id: string;
  item_id: string;
  asset_id: string | null;
  issue_description: string;
  maintenance_type: "damage" | "fault" | "repair" | "inspection" | "other";
  quantity_affected: number;
  reported_at: string;
  reported_by: string | null;
  source_feedback_id: string | null;
  assigned_person: string | null;
  scheduled_for: string | null;
  expected_completion_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  resolution_notes: string | null;
  status: EquipmentMaintenanceStatus;
  cost: number | null;
  cost_authorised_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3CalendarEventRow = {
  id: string;
  title: string;
  description: string | null;
  category: CalendarCategory;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  visibility: CalendarVisibility;
  status: CalendarStatus;
  is_recurring: boolean;
  attachment_file_id: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3CalendarAudienceRow = {
  id: string;
  event_id: string;
  audience_type: Phase3AudienceType;
  department_id: string | null;
  semester: number | null;
  student_directory_id: string | null;
  group_id: string | null;
  created_at: string;
};

export type Phase3RecurrenceRuleRow = {
  id: string;
  event_id: string;
  frequency: RecurrenceFrequency;
  interval_count: number;
  by_weekday: number[] | null;
  ends_on: string | null;
  occurrence_limit: number | null;
  created_at: string;
  updated_at: string;
};

export type Phase3CalendarOverrideRow = {
  id: string;
  rule_id: string;
  occurrence_starts_at: string;
  is_cancelled: boolean;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3FeedbackRequestRow = {
  id: string;
  student_directory_id: string;
  subject: string;
  category: FeedbackCategory;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  preferred_response: "in_app" | "email" | "either" | null;
  attachment_file_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
};

export type Phase3FeedbackReplyRow = {
  id: string;
  request_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type Phase3FeedbackHistoryRow = {
  id: number;
  request_id: string;
  from_status: FeedbackStatus | null;
  to_status: FeedbackStatus;
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

export type Phase3GameRuleCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase3GameRulePostRow = {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  introduction: string | null;
  history: string | null;
  about_game: string | null;
  how_to_play: string | null;
  rules_text: string | null;
  equipment_required: string | null;
  players_count: string | null;
  playing_area: string | null;
  instructions: string | null;
  safety_instructions: string | null;
  video_urls: string[];
  status: GameRuleStatus;
  published_at: string | null;
  is_featured: boolean;
  is_pinned: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3GameRuleBlockRow = {
  id: string;
  post_id: string;
  block_type: GameRuleBlockType;
  content: Json;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Phase3AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  priority: NotificationPriority;
  audience_summary: string | null;
  created_by: string | null;
  attachment_file_id: string | null;
  published_at: string;
  created_at: string;
};

export type Phase3NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  link: string | null;
  priority: NotificationPriority;
  announcement_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type Phase3NotificationPreferenceRow = {
  id: string;
  user_id: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  updated_at: string;
};

export type Phase3EmailAnnouncementRow = {
  id: string;
  announcement_id: string | null;
  title: string;
  body: string;
  link: string | null;
  attachment_file_id: string | null;
  audience_summary: string | null;
  daily_limit: number;
  status: EmailAnnouncementStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3EmailRecipientRow = {
  id: string;
  email_announcement_id: string;
  user_id: string;
  email: string;
  status: EmailRecipientStatus;
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  queued_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  updated_at: string;
};

export type Phase3SportsProfileRow = {
  user_id: string;
  biography: string | null;
  sports_interests: string[];
  preferred_sports: string[];
  profile_photo_file_id: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Phase3AchievementRow = {
  id: string;
  student_directory_id: string;
  title: string;
  sport: string;
  event_name: string | null;
  academic_year: string | null;
  achievement_date: string | null;
  position_result: string | null;
  award_description: string | null;
  evidence_file_id: string | null;
  verification_status: AchievementVerificationStatus;
  source_type: "student_entry" | "admin_record" | "future_event" | "future_game";
  source_reference: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase3ParticipationRow = {
  id: string;
  student_directory_id: string;
  source_type: "attendance" | "class_task" | "future_event" | "future_game" | "manual";
  source_reference: string;
  sport: string | null;
  activity_title: string;
  participated_at: string;
  is_verified: boolean;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          department_code: string;
          department_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          department_code: string;
          department_name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          department_code?: string;
          department_name?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_directory: {
        Row: {
          id: string;
          usn: string;
          full_name: string;
          department_id: string;
          academic_year: number;
          semester: number;
          official_email: string | null;
          is_active: boolean;
          source: "manual" | "import" | "registration";
          source_import_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usn: string;
          full_name: string;
          department_id: string;
          academic_year: number;
          semester: number;
          official_email?: string | null;
          is_active?: boolean;
          source?: "manual" | "import" | "registration";
          source_import_batch_id?: string | null;
        };
        Update: {
          usn?: string;
          full_name?: string;
          department_id?: string;
          academic_year?: number;
          semester?: number;
          official_email?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_directory_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          student_directory_id: string | null;
          requested_usn: string;
          full_name: string;
          email: string;
          verification_status: VerificationStatus;
          account_status: AccountStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          student_directory_id?: string | null;
          requested_usn: string;
          full_name: string;
          email: string;
          verification_status?: VerificationStatus;
          account_status?: AccountStatus;
        };
        Update: {
          full_name?: string;
          verification_status?: VerificationStatus;
          account_status?: AccountStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_student_directory_id_fkey";
            columns: ["student_directory_id"];
            referencedRelation: "student_directory";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AppRole;
        };
        Update: never;
        Relationships: [];
      };
      pe_memberships: {
        Row: {
          id: string;
          student_directory_id: string;
          status: MembershipStatus;
          added_by: string | null;
          removed_by: string | null;
          enrolled_at: string;
          ended_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_directory_id: string;
          status?: MembershipStatus;
          added_by?: string | null;
          removed_by?: string | null;
          enrolled_at?: string;
          ended_at?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: MembershipStatus;
          removed_by?: string | null;
          ended_at?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pe_memberships_student_directory_id_fkey";
            columns: ["student_directory_id"];
            referencedRelation: "student_directory";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          id: string;
          file_name: string;
          imported_by: string | null;
          total_rows: number;
          inserted_rows: number;
          skipped_rows: number;
          errors: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          imported_by?: string | null;
          total_rows: number;
          inserted_rows?: number;
          skipped_rows?: number;
          errors?: Json;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_table: string;
          target_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          target_table: string;
          target_id?: string | null;
          details?: Json;
        };
        Update: never;
        Relationships: [];
      };
      attendance_sessions: {
        Row: {
          id: string;
          title: string;
          class_date: string;
          starts_at: string;
          expected_ends_at: string;
          status: AttendanceSessionStatus;
          instructions: string | null;
          created_by: string | null;
          allow_concurrent: boolean;
          concurrent_reason: string | null;
          opened_at: string | null;
          closed_at: string | null;
          finalised_at: string | null;
          finalised_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          class_date: string;
          starts_at: string;
          expected_ends_at: string;
          status?: AttendanceSessionStatus;
          instructions?: string | null;
          created_by?: string | null;
          allow_concurrent?: boolean;
          concurrent_reason?: string | null;
          opened_at?: string | null;
          closed_at?: string | null;
          finalised_at?: string | null;
          finalised_by?: string | null;
        };
        Update: {
          title?: string;
          status?: AttendanceSessionStatus;
          instructions?: string | null;
          opened_at?: string | null;
          closed_at?: string | null;
          finalised_at?: string | null;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          session_id: string;
          student_directory_id: string;
          membership_id: string | null;
          status: AttendanceStatus;
          submitted_type: AttendanceSubmissionType | null;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          administrative_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_student_directory_id_fkey";
            columns: ["student_directory_id"];
            referencedRelation: "student_directory";
            referencedColumns: ["id"];
          },
        ];
      };
      class_tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          starts_at: string;
          due_at: string;
          priority: "low" | "normal" | "high";
          instructions: string | null;
          submission_requirements: string | null;
          allow_text: boolean;
          allow_files: boolean;
          allow_links: boolean;
          max_file_size_bytes: number;
          allowed_file_types: string[];
          max_files: number;
          status: TaskStatus;
          created_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      task_audiences: {
        Row: {
          id: string;
          task_id: string;
          audience_type: AudienceType;
          department_id: string | null;
          semester: number | null;
          student_directory_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "task_audiences_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "class_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_submissions: {
        Row: {
          id: string;
          task_id: string;
          student_directory_id: string;
          user_id: string | null;
          status: TaskSubmissionStatus;
          text_content: string | null;
          link_url: string | null;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "class_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_submission_history: {
        Row: {
          id: number;
          submission_id: string;
          actor_id: string | null;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      stored_files: {
        Row: {
          id: string;
          object_key: string;
          bucket: string;
          original_filename: string;
          content_type: string;
          byte_size: number;
          uploader_id: string | null;
          parent_type: "task_reference" | "task_submission";
          parent_id: string;
          upload_status: "pending" | "confirmed" | "failed";
          sha256: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      visitor_purposes: {
        Row: {
          id: string;
          label: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          label?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      visitor_records: {
        Row: {
          id: string;
          qr_code_id: string | null;
          visitor_user_id: string | null;
          student_directory_id: string | null;
          full_name: string;
          usn: string | null;
          department_id: string | null;
          academic_year: number | null;
          semester: number | null;
          purpose_id: string;
          purpose_detail: string | null;
          description: string | null;
          identity_source: "authenticated_profile" | "guest_input";
          bot_check_passed: boolean;
          visited_at: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "visitor_records_purpose_id_fkey";
            columns: ["purpose_id"];
            referencedRelation: "visitor_purposes";
            referencedColumns: ["id"];
          },
        ];
      };
      pe_rooms: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          instructions: string | null;
          requires_activity: boolean;
          max_session_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          instructions?: string | null;
          requires_activity?: boolean;
          max_session_minutes?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          instructions?: string | null;
          requires_activity?: boolean;
          max_session_minutes?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      room_activities: {
        Row: {
          id: string;
          room_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "room_activities_room_id_fkey";
            columns: ["room_id"];
            referencedRelation: "pe_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_sessions: {
        Row: {
          id: string;
          room_id: string;
          user_id: string | null;
          student_directory_id: string;
          activity_id: string | null;
          activity_name: string | null;
          started_at: string;
          ended_at: string | null;
          force_closed_by: string | null;
          force_closed_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "room_sessions_room_id_fkey";
            columns: ["room_id"];
            referencedRelation: "pe_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_codes: {
        Row: {
          id: string;
          name: string;
          qr_type: QrType;
          token: string;
          destination_path: string;
          room_id: string | null;
          theme: "entrance" | "playing" | "gym" | "mental" | "equipment";
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          qr_type: QrType;
          token: string;
          destination_path: string;
          room_id?: string | null;
          theme: "entrance" | "playing" | "gym" | "mental" | "equipment";
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      phase3_files: Phase3Table<Phase3FileRow>;
      student_groups: Phase3Table<Phase3StudentGroupRow>;
      student_group_members: Phase3Table<{
        id: string;
        group_id: string;
        student_directory_id: string;
        created_at: string;
      }>;
      equipment_categories: Phase3Table<Phase3EquipmentCategoryRow>;
      equipment_items: Phase3Table<Phase3EquipmentItemRow>;
      equipment_assets: Phase3Table<Phase3EquipmentAssetRow>;
      equipment_transactions: Phase3Table<Phase3EquipmentTransactionRow>;
      equipment_return_records: Phase3Table<Phase3EquipmentReturnRow>;
      equipment_stock_adjustments: Phase3Table<{
        id: string;
        item_id: string;
        quantity_delta: number;
        reason: string;
        administrator_id: string | null;
        created_at: string;
      }>;
      equipment_maintenance_records: Phase3Table<Phase3MaintenanceRow>;
      equipment_qr_links: Phase3Table<{
        qr_code_id: string;
        item_id: string;
        asset_id: string | null;
        created_at: string;
      }>;
      pe_calendar_events: Phase3Table<Phase3CalendarEventRow>;
      calendar_audiences: Phase3Table<Phase3CalendarAudienceRow>;
      calendar_recurrence_rules: Phase3Table<Phase3RecurrenceRuleRow>;
      calendar_event_overrides: Phase3Table<Phase3CalendarOverrideRow>;
      feedback_requests: Phase3Table<Phase3FeedbackRequestRow>;
      feedback_replies: Phase3Table<Phase3FeedbackReplyRow>;
      feedback_status_history: Phase3Table<Phase3FeedbackHistoryRow>;
      game_rule_categories: Phase3Table<Phase3GameRuleCategoryRow>;
      game_rule_posts: Phase3Table<Phase3GameRulePostRow>;
      game_rule_blocks: Phase3Table<Phase3GameRuleBlockRow>;
      announcements: Phase3Table<Phase3AnnouncementRow>;
      announcement_audiences: Phase3Table<{
        id: string;
        announcement_id: string;
        audience_type: Phase3AudienceType;
        department_id: string | null;
        semester: number | null;
        student_directory_id: string | null;
        group_id: string | null;
        created_at: string;
      }>;
      notifications: Phase3Table<Phase3NotificationRow>;
      notification_preferences: Phase3Table<Phase3NotificationPreferenceRow>;
      email_announcements: Phase3Table<Phase3EmailAnnouncementRow>;
      email_recipients: Phase3Table<Phase3EmailRecipientRow>;
      email_delivery_events: Phase3Table<{
        id: string;
        recipient_id: string | null;
        provider_event_id: string;
        event_type: "accepted" | "delivered" | "bounced" | "complained" | "failed";
        payload: Json;
        created_at: string;
      }>;
      email_daily_usage: Phase3Table<{
        usage_date: string;
        accepted_count: number;
        updated_at: string;
      }>;
      sports_profile_details: Phase3Table<Phase3SportsProfileRow>;
      sports_achievements: Phase3Table<Phase3AchievementRow>;
      sports_participation_records: Phase3Table<Phase3ParticipationRow>;

      /* Phase 4 — events and tournaments */
      phase4_files: Phase4Table<Phase4FileRow>;
      sports_events: Phase4Table<Phase4EventRow>;
      event_sports: Phase4Table<Phase4SportRow>;
      competition_rules: Phase4Table<Phase4RulesRow>;
      competition_eligibility_rules: Phase4Table<Phase4EligibilityRow>;
      competition_entries: Phase4Table<Phase4EntryRow>;
      competition_entry_members: Phase4Table<Phase4MemberRow>;
      registration_history: Phase4Table<{
        id: number;
        entry_id: string;
        actor_id: string | null;
        action: string;
        from_status: string | null;
        to_status: string | null;
        details: Json;
        created_at: string;
      }>;
      participant_invitations: Phase4Table<{
        id: string;
        entry_id: string;
        member_id: string;
        token_hash: string;
        expires_at: string;
        accepted_at: string | null;
        revoked_at: string | null;
        created_at: string;
      }>;
      competition_payment_settings: Phase4Table<Phase4PaymentSettingsRow>;
      competition_payment_records: Phase4Table<Phase4PaymentRecordRow>;
      payment_verification_history: Phase4Table<{
        id: number;
        payment_id: string;
        actor_id: string | null;
        action: string;
        from_status: string | null;
        to_status: string | null;
        note: string | null;
        created_at: string;
      }>;
      tournament_draws: Phase4Table<Phase4DrawRow>;
      tournament_stages: Phase4Table<{
        id: string;
        draw_id: string;
        stage_key: string;
        name: string;
        stage_type: "group" | "league" | "knockout" | "third_place";
        sequence: number;
        created_at: string;
      }>;
      tournament_groups: Phase4Table<{
        id: string;
        stage_id: string;
        group_key: string;
        name: string;
        sort_order: number;
        created_at: string;
      }>;
      tournament_participants: Phase4Table<{
        id: string;
        draw_id: string;
        entry_id: string | null;
        group_id: string | null;
        placeholder_key: string | null;
        seed: number | null;
        status: "active" | "qualified" | "eliminated" | "withdrawn";
        created_at: string;
      }>;
      tournament_matches: Phase4Table<Phase4MatchRow>;
      tournament_match_slots: Phase4Table<Phase4SlotRow>;
      tournament_match_results: Phase4Table<Phase4ResultRow>;
      tournament_match_result_history: Phase4Table<{
        id: number;
        match_id: string;
        result_id: string | null;
        actor_id: string | null;
        action: string;
        details: Json;
        created_at: string;
      }>;
      tournament_standings: Phase4Table<Phase4StandingRow>;
      tournament_graph_edges: Phase4Table<{
        id: string;
        draw_id: string;
        source_match_id: string;
        target_match_id: string;
        target_slot: "a" | "b";
        feed: "winner" | "loser";
        created_at: string;
      }>;
      tournament_node_positions: Phase4Table<{
        draw_id: string;
        node_key: string;
        position: Json;
        updated_at: string;
      }>;
      sport_organizer_assignments: Phase4Table<Phase4AssignmentRow>;
      organizer_invitations: Phase4Table<Phase4InvitationRow>;
      organizer_activity_logs: Phase4Table<{
        id: number;
        competition_id: string;
        user_id: string | null;
        match_id: string | null;
        action: string;
        details: Json;
        created_at: string;
      }>;
      phase4_calendar_links: Phase4Table<{
        source_type: "event" | "match";
        source_id: string;
        calendar_event_id: string;
        created_at: string;
      }>;

      /* Phase 5 — games, challenges, matches, ratings and moderation */
      game_catalog: Phase5Table<Phase5GameRow>;
      game_settings: Phase5Table<Phase5GameSettingsRow>;
      game_achievement_rules: Phase5Table<{
        id: string;
        code: string;
        title: string;
        description: string;
        game_slug: Phase5GameSlug | null;
        criteria: Json;
        is_enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;
      gaming_profiles: Phase5Table<Phase5GamingProfileRow>;
      game_ratings: Phase5Table<Phase5RatingRow>;
      game_rating_history: Phase5Table<Phase5RatingHistoryRow>;
      game_challenges: Phase5Table<Phase5ChallengeRow>;
      challenge_history: Phase5Table<{
        id: number;
        challenge_id: string;
        actor_id: string | null;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        created_at: string;
      }>;
      game_matches: Phase5Table<Phase5MatchRow>;
      game_match_players: Phase5Table<Phase5MatchPlayerRow>;
      game_match_actions: Phase5Table<Phase5ActionRow>;
      game_match_state_snapshots: Phase5Table<{
        id: number;
        match_id: string;
        version: number;
        state: Json;
        created_at: string;
      }>;
      game_match_results: Phase5Table<Phase5ResultRow>;
      guest_game_sessions: Phase5Table<{
        id: string;
        anonymous_id: string;
        game_slug: Phase5GameSlug;
        created_at: string;
        last_seen_at: string;
        expires_at: string;
      }>;
      guest_match_sessions: Phase5Table<{
        id: string;
        guest_session_id: string | null;
        game_slug: Phase5GameSlug;
        state: Json;
        status: "active" | "completed" | "expired";
        created_at: string;
        updated_at: string;
        expires_at: string;
      }>;
      game_reports: Phase5Table<{
        id: string;
        reporter_id: string;
        reported_user_id: string | null;
        match_id: string | null;
        game_slug: Phase5GameSlug | null;
        reason: "abuse" | "cheating" | "harassment" | "inappropriate_name" | "dispute" | "other";
        details: string | null;
        status: "open" | "reviewing" | "resolved" | "dismissed";
        reviewed_by: string | null;
        review_note: string | null;
        created_at: string;
        updated_at: string;
      }>;
      match_disputes: Phase5Table<{
        id: string;
        match_id: string;
        opened_by: string;
        reason: string;
        details: string | null;
        status: "open" | "reviewing" | "resolved" | "rejected";
        resolution: string | null;
        reviewed_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      gaming_restrictions: Phase5Table<{
        id: string;
        user_id: string;
        game_slug: Phase5GameSlug | null;
        restriction_type: "all" | "ranked" | "challenge" | "public_profile";
        reason: string;
        is_active: boolean;
        expires_at: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      rating_adjustment_history: Phase5Table<{
        id: string;
        user_id: string;
        game_slug: Phase5GameSlug;
        before_rating: number;
        after_rating: number;
        delta: number;
        reason: string;
        adjusted_by: string;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      normalize_usn: {
        Args: { p_usn: string };
        Returns: string;
      };
      is_pe_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      has_role: {
        Args: { p_role: AppRole; p_user_id?: string };
        Returns: boolean;
      };
      update_my_profile: {
        Args: { p_full_name: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"][];
      };
      admin_set_pe_membership: {
        Args: {
          p_student_directory_id: string;
          p_active: boolean;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["pe_memberships"]["Row"][];
      };
      admin_import_student_directory: {
        Args: { p_rows: Json; p_file_name: string };
        Returns: Json;
      };
      is_active_pe_student: { Args: { p_user_id?: string }; Returns: boolean };
      admin_log_action: {
        Args: {
          p_action: string;
          p_target_table: string;
          p_target_id?: string | null;
          p_details?: Json | null;
        };
        Returns: undefined;
      };
      student_matches_task: {
        Args: { p_task_id: string; p_user_id?: string };
        Returns: boolean;
      };
      admin_create_attendance_session: {
        Args: {
          p_title: string;
          p_class_date: string;
          p_starts_at: string;
          p_expected_ends_at: string;
          p_instructions?: string | null;
          p_allow_concurrent?: boolean;
          p_concurrent_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"][];
      };
      admin_set_attendance_session_status: {
        Args: { p_session_id: string; p_status: AttendanceSessionStatus };
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"][];
      };
      student_submit_attendance: {
        Args: { p_session_id: string; p_type: AttendanceSubmissionType };
        Returns: Database["public"]["Tables"]["attendance_records"]["Row"][];
      };
      admin_review_attendance: {
        Args: { p_record_id: string; p_decision: string; p_note?: string | null };
        Returns: Database["public"]["Tables"]["attendance_records"]["Row"][];
      };
      admin_finalise_attendance: {
        Args: { p_session_id: string; p_remaining_status?: "absent" | "excused" };
        Returns: Database["public"]["Tables"]["attendance_records"]["Row"][];
      };
      admin_save_class_task: {
        Args: {
          p_task_id: string;
          p_title: string;
          p_description: string;
          p_category: string;
          p_starts_at: string;
          p_due_at: string;
          p_priority: "low" | "normal" | "high";
          p_instructions: string | null;
          p_submission_requirements: string | null;
          p_allow_text: boolean;
          p_allow_files: boolean;
          p_allow_links: boolean;
          p_max_file_size_bytes: number;
          p_allowed_file_types: string[];
          p_max_files: number;
          p_status: TaskStatus;
          p_audiences: Json;
        };
        Returns: Database["public"]["Tables"]["class_tasks"]["Row"][];
      };
      student_save_task_submission: {
        Args: {
          p_task_id: string;
          p_text_content: string | null;
          p_link_url: string | null;
          p_submit?: boolean;
        };
        Returns: Database["public"]["Tables"]["task_submissions"]["Row"][];
      };
      admin_review_task_submission: {
        Args: { p_submission_id: string; p_status: TaskSubmissionStatus; p_feedback?: string | null };
        Returns: Database["public"]["Tables"]["task_submissions"]["Row"][];
      };
      create_file_upload: {
        Args: {
          p_parent_type: "task_reference" | "task_submission";
          p_parent_id: string;
          p_original_filename: string;
          p_content_type: string;
          p_byte_size: number;
        };
        Returns: Json;
      };
      confirm_file_upload: {
        Args: { p_file_id: string; p_verified_size: number; p_verified_content_type: string };
        Returns: Database["public"]["Tables"]["stored_files"]["Row"][];
      };
      submit_visitor_entry: {
        Args: {
          p_token: string;
          p_full_name: string | null;
          p_usn: string | null;
          p_department_id: string | null;
          p_academic_year: number | null;
          p_semester: number | null;
          p_purpose_id: string;
          p_purpose_detail: string | null;
          p_description: string | null;
          p_bot_check_passed?: boolean;
        };
        Returns: Json;
      };
      get_today_visitors: {
        Args: Record<string, never>;
        Returns: Array<{ visitor_label: string; purpose_label: string; visited_at: string }>;
      };
      admin_correct_visitor_record: {
        Args: { p_visitor_id: string; p_reason: string };
        Returns: Database["public"]["Tables"]["visitor_records"]["Row"][];
      };
      student_enter_room: {
        Args: { p_token: string; p_activity_id?: string | null };
        Returns: Database["public"]["Tables"]["room_sessions"]["Row"][];
      };
      student_exit_room: {
        Args: { p_token: string };
        Returns: Database["public"]["Tables"]["room_sessions"]["Row"][];
      };
      admin_close_room_session: {
        Args: { p_session_id: string; p_reason: string };
        Returns: Database["public"]["Tables"]["room_sessions"]["Row"][];
      };
      resolve_qr_token: {
        Args: { p_token: string };
        Returns: Array<{
          qr_type: QrType;
          destination_path: string;
          room_code: string | null;
          room_name: string | null;
          requires_activity: boolean | null;
          theme: string;
        }>;
      };
      admin_set_qr_active: {
        Args: { p_qr_id: string; p_active: boolean };
        Returns: Database["public"]["Tables"]["qr_codes"]["Row"][];
      };
      admin_regenerate_qr: {
        Args: { p_qr_id: string };
        Returns: Database["public"]["Tables"]["qr_codes"]["Row"][];
      };
      create_phase3_upload: {
        Args: {
          p_parent_type: Phase3ParentType;
          p_parent_id: string;
          p_original_filename: string;
          p_content_type: string;
          p_byte_size: number;
          p_visibility?: "private" | "public";
        };
        Returns: Array<{ file_id: string; object_key: string }>;
      };
      confirm_phase3_upload: {
        Args: { p_file_id: string; p_verified_size: number; p_verified_content_type: string };
        Returns: Phase3FileRow[];
      };
      student_attach_phase3_file: {
        Args: { p_parent_type: "feedback_attachment" | "achievement_evidence"; p_parent_id: string; p_file_id: string };
        Returns: undefined;
      };
      authorize_phase3_download: {
        Args: { p_file_id: string };
        Returns: Array<{
          object_key: string;
          content_type: string;
          original_filename: string;
          byte_size: number;
        }>;
      };
      phase3_student_directory_id: { Args: { p_user_id?: string }; Returns: string | null };
      phase3_matches_audience: { Args: { p_audiences: Json; p_user_id?: string }; Returns: boolean };
      can_view_calendar_event: { Args: { p_event_id: string; p_user_id?: string | null }; Returns: boolean };
      student_matches_calendar: { Args: { p_event_id: string; p_user_id?: string }; Returns: boolean };
      admin_save_equipment_category: {
        Args: { p_category_id: string | null; p_data: Json };
        Returns: Phase3EquipmentCategoryRow[];
      };
      admin_save_equipment_item: {
        Args: { p_item_id: string | null; p_data: Json };
        Returns: Phase3EquipmentItemRow[];
      };
      admin_create_equipment_asset: {
        Args: { p_item_id: string; p_data: Json };
        Returns: Phase3EquipmentAssetRow[];
      };
      admin_adjust_equipment_stock: {
        Args: { p_item_id: string; p_quantity_delta: number; p_reason: string };
        Returns: Phase3EquipmentItemRow[];
      };
      borrow_equipment: {
        Args: {
          p_item_id: string;
          p_asset_id: string | null;
          p_quantity: number;
          p_expected_return_at: string;
          p_notes?: string | null;
          p_student_directory_id?: string | null;
        };
        Returns: Phase3EquipmentTransactionRow[];
      };
      return_equipment: {
        Args: {
          p_transaction_id: string;
          p_quantity: number;
          p_condition: EquipmentCondition;
          p_damage_indicator?: boolean;
          p_notes?: string | null;
        };
        Returns: Phase3EquipmentTransactionRow[];
      };
      admin_correct_equipment_transaction: {
        Args: {
          p_transaction_id: string;
          p_reason: string;
          p_expected_return_at?: string | null;
          p_status?: EquipmentTransactionStatus | null;
        };
        Returns: Phase3EquipmentTransactionRow[];
      };
      admin_save_equipment_maintenance: {
        Args: { p_record_id: string | null; p_data: Json };
        Returns: Phase3MaintenanceRow[];
      };
      admin_set_equipment_maintenance_status: {
        Args: {
          p_record_id: string;
          p_status: EquipmentMaintenanceStatus;
          p_resolution_notes?: string | null;
          p_cost?: number | null;
        };
        Returns: Phase3MaintenanceRow[];
      };
      admin_create_equipment_qr: {
        Args: { p_name: string; p_item_id: string; p_asset_id?: string | null };
        Returns: Database["public"]["Tables"]["qr_codes"]["Row"][];
      };
      resolve_equipment_qr: {
        Args: { p_token: string };
        Returns: Array<{
          qr_id: string;
          item_id: string;
          asset_id: string | null;
          item_name: string;
          tracking_mode: EquipmentTrackingMode;
          available_quantity: number;
          asset_tag: string | null;
          condition: EquipmentCondition;
          theme: string;
        }>;
      };
      admin_save_calendar_event: {
        Args: { p_event_id: string | null; p_data: Json; p_audiences: Json; p_recurrence?: Json | null };
        Returns: Phase3CalendarEventRow[];
      };
      admin_save_calendar_override: {
        Args: { p_rule_id: string; p_occurrence_starts_at: string; p_data: Json };
        Returns: Phase3CalendarOverrideRow[];
      };
      student_submit_feedback: { Args: { p_data: Json }; Returns: Phase3FeedbackRequestRow[] };
      student_reply_feedback: { Args: { p_request_id: string; p_body: string }; Returns: Phase3FeedbackReplyRow[] };
      admin_update_feedback: {
        Args: {
          p_request_id: string;
          p_status: FeedbackStatus;
          p_priority?: FeedbackPriority | null;
          p_response?: string | null;
          p_internal_note?: string | null;
        };
        Returns: Phase3FeedbackRequestRow[];
      };
      admin_save_game_rule_category: {
        Args: { p_category_id: string | null; p_data: Json };
        Returns: Phase3GameRuleCategoryRow[];
      };
      admin_save_game_rule_post: {
        Args: { p_post_id: string | null; p_data: Json; p_blocks?: Json | null };
        Returns: Phase3GameRulePostRow[];
      };
      admin_create_student_group: {
        Args: { p_group_id: string | null; p_data: Json };
        Returns: Phase3StudentGroupRow[];
      };
      admin_set_group_member: {
        Args: { p_group_id: string; p_student_directory_id: string; p_member: boolean };
        Returns: undefined;
      };
      admin_create_announcement: {
        Args: {
          p_data: Json;
          p_audiences: Json;
          p_send_email?: boolean;
          p_daily_limit?: number;
        };
        Returns: Json;
      };
      student_mark_notification_read: {
        Args: { p_notification_id: string; p_read?: boolean };
        Returns: Phase3NotificationRow[];
      };
      student_mark_all_notifications_read: { Args: Record<string, never>; Returns: number };
      student_set_notification_preference: {
        Args: { p_category: NotificationCategory; p_channel: NotificationChannel; p_enabled: boolean };
        Returns: Phase3NotificationPreferenceRow[];
      };
      admin_claim_email_batch: {
        Args: { p_email_announcement_id: string; p_batch_size?: number };
        Returns: Array<{
          recipient_id: string;
          user_id: string;
          email: string;
          title: string;
          body: string;
          link: string | null;
          attempt_number: number;
        }>;
      };
      admin_record_email_result: {
        Args: {
          p_recipient_id: string;
          p_provider_status: string;
          p_provider_message_id?: string | null;
          p_error?: string | null;
        };
        Returns: Phase3EmailRecipientRow[];
      };
      admin_complete_email_announcement: {
        Args: { p_email_announcement_id: string };
        Returns: Phase3EmailAnnouncementRow[];
      };
      admin_requeue_failed_emails: {
        Args: { p_email_announcement_id: string };
        Returns: number;
      };
      record_email_provider_event: {
        Args: {
          p_provider_message_id: string;
          p_event_type: string;
          p_provider_event_id: string;
          p_payload?: Json;
        };
        Returns: undefined;
      };
      student_save_sports_profile: { Args: { p_data: Json }; Returns: Phase3SportsProfileRow[] };
      student_suggest_achievement: { Args: { p_data: Json }; Returns: Phase3AchievementRow[] };
      admin_save_achievement: {
        Args: { p_achievement_id: string | null; p_data: Json };
        Returns: Phase3AchievementRow[];
      };
      admin_review_achievement: {
        Args: { p_achievement_id: string; p_status: AchievementVerificationStatus; p_note?: string | null };
        Returns: Phase3AchievementRow[];
      };
      get_public_sports_profile: {
        Args: { p_student_directory_id: string };
        Returns: Array<{
          full_name: string;
          department_name: string;
          academic_year: number;
          semester: number;
          biography: string | null;
          preferred_sports: string[];
          sports_interests: string[];
          achievements: Json;
        }>;
      };

      /* Phase 4 RPCs */
      phase3_notify_user: {
        Args: {
          p_user_id: string;
          p_title: string;
          p_body: string;
          p_category?: string;
          p_link?: string | null;
          p_priority?: string;
          p_announcement_id?: string | null;
        };
        Returns: string | null;
      };
      phase4_validate_plan: { Args: { p_plan: Json }; Returns: string[] };
      phase4_save_draw: {
        Args: { p_competition_id: string; p_plan: Json; p_reason?: string | null };
        Returns: Json;
      };
      phase4_save_node_positions: { Args: { p_draw_id: string; p_positions: Json }; Returns: number };
      phase4_set_draw_lock: {
        Args: { p_draw_id: string; p_locked: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      phase4_submit_match_result: {
        Args: { p_match_id: string; p_result: Json; p_require_approval?: boolean };
        Returns: Json;
      };
      phase4_correct_match_result: {
        Args: { p_match_id: string; p_result: Json; p_reason: string };
        Returns: Json;
      };
      phase4_admin_update_match: {
        Args: { p_match_id: string; p_data: Json; p_reason?: string | null };
        Returns: undefined;
      };
      phase4_organizer_update_match: {
        Args: { p_match_id: string; p_data: Json };
        Returns: undefined;
      };
      phase4_create_organizer_invitation: {
        Args: { p_competition_id: string; p_student_directory_id: string; p_expires_hours?: number };
        Returns: Json;
      };
      phase4_accept_organizer_invitation: { Args: { p_token: string }; Returns: Json };
      phase4_revoke_organizer_assignment: {
        Args: { p_assignment_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      phase4_revoke_organizer_invitation: {
        Args: { p_invitation_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      phase4_submit_entry: { Args: { p_competition_id: string; p_payload: Json }; Returns: Json };
      phase4_review_entry: {
        Args: { p_entry_id: string; p_status: string; p_note?: string | null };
        Returns: Json;
      };
      phase4_verify_payment: {
        Args: { p_payment_id: string; p_status: string; p_note?: string | null };
        Returns: Json;
      };
      phase4_submit_payment_proof: {
        Args: {
          p_entry_id: string;
          p_proof_file_id: string;
          p_transaction_reference?: string | null;
          p_claimed_amount?: number | null;
        };
        Returns: Json;
      };
      phase4_respond_participant_invitation: {
        Args: { p_token: string; p_accept: boolean };
        Returns: Json;
      };
      phase4_authorize_upload: {
        Args: {
          p_parent_type: string;
          p_parent_id: string;
          p_original_filename: string;
          p_content_type: string;
          p_byte_size: number;
          p_visibility?: string;
        };
        Returns: Json;
      };
      phase4_confirm_upload: {
        Args: { p_file_id: string; p_verified_size: number; p_verified_content_type?: string | null };
        Returns: Json;
      };
      phase4_authorize_download: {
        Args: { p_file_id: string };
        Returns: Array<{
          object_key: string;
          content_type: string;
          original_filename: string;
          byte_size: number;
        }>;
      };

      /* Phase 5 RPCs */
      phase3_log: {
        Args: { p_action: string; p_entity_type: string; p_entity_id: string; p_details?: Json | null };
        Returns: undefined;
      };
      phase5_is_admin: { Args: Record<string, never>; Returns: boolean };
      phase5_is_match_participant: { Args: { p_match_id: string; p_user_id?: string }; Returns: boolean };
      phase5_game_enabled: { Args: { p_slug: string; p_mode?: string }; Returns: boolean };
      phase5_public_profile_visible: { Args: { p_user_id: string }; Returns: boolean };
      phase5_name_key: { Args: { p_name: string }; Returns: string };
      phase5_ensure_profile: { Args: { p_gaming_name: string }; Returns: Phase5GamingProfileRow };
      phase5_update_profile: {
        Args: {
          p_gaming_name?: string | null;
          p_visibility?: string | null;
          p_searchable?: boolean | null;
          p_challenges_enabled?: boolean | null;
          p_bio?: string | null;
        };
        Returns: Phase5GamingProfileRow;
      };
      phase5_search_profiles: {
        Args: { p_query: string };
        Returns: Array<{ user_id: string; gaming_name: string; department_name: string | null }>;
      };
      phase5_create_challenge: {
        Args: { p_game_slug: string; p_opponent_id: string; p_settings?: Json | null; p_message?: string | null };
        Returns: string;
      };
      phase5_respond_challenge: {
        Args: { p_challenge_id: string; p_accept: boolean };
        Returns: Json;
      };
      phase5_cancel_challenge: { Args: { p_challenge_id: string }; Returns: undefined };
      phase5_expire_challenges: { Args: Record<string, never>; Returns: number };
      phase5_set_ready: { Args: { p_public_id: string; p_ready: boolean }; Returns: Json };
      phase5_set_connection: { Args: { p_public_id: string; p_connected: boolean }; Returns: undefined };
      phase5_start_match: { Args: { p_public_id: string }; Returns: undefined };
      phase5_open_dispute: {
        Args: { p_public_id: string; p_reason: string; p_details?: string | null };
        Returns: string;
      };
      phase5_submit_action: {
        Args: {
          p_public_id: string;
          p_user_id: string;
          p_actor: number;
          p_seq: number;
          p_expected_version: number;
          p_type: string;
          p_payload: Json;
          p_state: Json;
          p_events?: Json | null;
          p_outcome?: Json | null;
        };
        Returns: Json;
      };
      phase5_admin_save_game: { Args: { p_slug: string; p_data: Json }; Returns: undefined };
      phase5_admin_save_settings: { Args: { p_slug: string; p_data: Json }; Returns: undefined };
      phase5_admin_adjust_rating: {
        Args: { p_user_id: string; p_game_slug: string; p_new_rating: number; p_reason: string };
        Returns: number;
      };
      phase5_admin_moderate_name: { Args: { p_user_id: string; p_action: string; p_note?: string | null }; Returns: undefined };
      phase5_admin_review_report: { Args: { p_report_id: string; p_status: string; p_note?: string | null }; Returns: undefined };
      phase5_admin_review_dispute: { Args: { p_dispute_id: string; p_status: string; p_resolution?: string | null }; Returns: undefined };
      phase5_admin_set_restriction: {
        Args: {
          p_user_id: string;
          p_game_slug: string;
          p_type: string;
          p_reason: string;
          p_expires_at?: string | null;
          p_active?: boolean;
        };
        Returns: string;
      };
      phase5_cleanup_guest_sessions: { Args: Record<string, never>; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
