import { describe, expect, it } from "vitest";
import { parseDirectoryFile } from "@/lib/utils/import-file";

function csvFile(content: string, name = "directory.csv") {
  return new File([content], name, { type: "text/csv" });
}

describe("parseDirectoryFile", () => {
  it("maps template headers and flags invalid rows", async () => {
    const content = [
      "USN,Full Name,Department Code,Academic Year,Semester,Official Email",
      "1AB21CS001,A Student,CSE,2,4,student@college.edu",
      "BAD,,CSE,9,99,",
    ].join("\n");

    const result = await parseDirectoryFile(csvFile(content));

    expect(result.totalDataRows).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      usn: "1AB21CS001",
      full_name: "A Student",
      department_code: "CSE",
      academic_year: "2",
      semester: "4",
    });
    expect(result.issues[0]?.row).toBe(3);
  });

  it("rejects files without the required columns", async () => {
    await expect(
      parseDirectoryFile(csvFile("USN,Name\n1AB21CS001,A Student")),
    ).rejects.toThrow(/Missing column/);
  });
});
