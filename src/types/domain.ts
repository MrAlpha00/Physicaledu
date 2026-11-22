import type {
  AccountStatus,
  AppRole,
  MembershipStatus,
  VerificationStatus,
} from "@/types/database";

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  studentCount: number;
}

export interface ActiveDepartment {
  id: string;
  code: string;
  name: string;
}

export interface DirectoryRow {
  id: string;
  usn: string;
  fullName: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  academicYear: number;
  semester: number;
  officialEmail: string | null;
  isActive: boolean;
  source: "manual" | "import" | "registration";
  createdAt: string;
  profile: {
    id: string;
    verificationStatus: VerificationStatus;
    accountStatus: AccountStatus;
  } | null;
  membership: {
    id: string;
    status: MembershipStatus;
    enrolledAt: string;
  } | null;
}

export interface ProfileRow {
  id: string;
  fullName: string;
  email: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: string;
  directory: {
    usn: string;
    departmentCode: string;
    departmentName: string;
    academicYear: number;
    semester: number;
    officialEmail: string | null;
  } | null;
  roles: AppRole[];
}

export interface StudentAccountRow {
  id: string;
  fullName: string;
  email: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: string;
  usn: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  academicYear: number | null;
  semester: number | null;
  isPeStudent: boolean;
  roles: AppRole[];
}

export interface ImportRow {
  usn: string;
  full_name: string;
  department_code: string;
  academic_year: string;
  semester: string;
  official_email: string;
}

export interface ImportIssue {
  row: number;
  usn: string | null;
  message: string;
}

export interface ImportResult {
  batch_id: string;
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  errors: ImportIssue[];
}

export interface ImportBatchSummary {
  id: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  createdAt: string;
}

export interface AdminMetrics {
  registeredAccounts: number;
  directoryRecords: number;
  peStudents: number;
  pendingVerifications: number;
  activeDepartments: number;
}

export interface RecentRegistration {
  id: string;
  fullName: string;
  usn: string | null;
  email: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface ActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
}
