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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
