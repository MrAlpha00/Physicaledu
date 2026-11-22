import { describe, expect, it } from "vitest";
import { registrationSchema } from "@/lib/validations/auth";
import { departmentSchema, importRowSchema } from "@/lib/validations/admin";

const validRegistration = {
  fullName: "A Student",
  usn: "1AB21CS001",
  email: "student@college.edu",
  departmentId: "c9f4a9bc-7f6e-4a5b-9a0d-9c8e5b6a1234",
  academicYear: 2,
  semester: 4,
  password: "StrongPass1",
  confirmPassword: "StrongPass1",
};

describe("registrationSchema", () => {
  it("accepts complete details", () => {
    expect(registrationSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("rejects weak passwords and mismatched confirmation", () => {
    const weak = registrationSchema.safeParse({ ...validRegistration, password: "short" });
    expect(weak.success).toBe(false);

    const mismatch = registrationSchema.safeParse({
      ...validRegistration,
      confirmPassword: "Different1",
    });
    expect(mismatch.success).toBe(false);
  });

  it("rejects invalid emails and out-of-range semesters", () => {
    expect(
      registrationSchema.safeParse({ ...validRegistration, email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...validRegistration, semester: 13 }).success,
    ).toBe(false);
  });
});

describe("admin validation", () => {
  it("enforces department code format", () => {
    expect(departmentSchema.safeParse({ departmentCode: "CSE", departmentName: "Computer Science" }).success).toBe(true);
    expect(departmentSchema.safeParse({ departmentCode: "CSE-1", departmentName: "Computer Science" }).success).toBe(false);
  });

  it("validates import rows", () => {
    const row = {
      usn: "1AB21CS001",
      full_name: "A Student",
      department_code: "CSE",
      academic_year: "2",
      semester: "4",
      official_email: "",
    };
    expect(importRowSchema.safeParse(row).success).toBe(true);
    expect(importRowSchema.safeParse({ ...row, semester: "13" }).success).toBe(false);
  });
});
