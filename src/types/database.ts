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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
