import { describe, expect, it } from "vitest";
import {
  attendancePercentage,
  canStudentSubmit,
  computeAttendanceOverview,
  describeAttendanceError,
  splitAttendanceRows,
} from "@/lib/operations/attendance";
import {
  audienceSummary,
  describeTaskError,
  displaySubmissionStatus,
  isTaskAcceptingSubmissions,
  validateAudiences,
} from "@/lib/operations/tasks";
import {
  describeRoomError,
  elapsedMinutes,
  isRoomQrType,
  isStaleSession,
  totalOccupancy,
} from "@/lib/operations/rooms";
import {
  describeVisitorError,
  honeypotTriggered,
  maskVisitorName,
} from "@/lib/operations/visitors";
import { buildQrDestination, parseQrScanValue } from "@/lib/qr/qr-config";
import {
  DEFAULT_ALLOWED_TYPES,
  humanFileSize,
  sanitizeFilename,
  validateTaskFile,
} from "@/lib/storage/file-validation";
import { SlidingWindowRateLimiter } from "@/lib/utils/rate-limit";
import {
  addIstDays,
  istDateString,
  istDayEnd,
  istDayStart,
  resolveDateRange,
} from "@/lib/time/india";
import type { AttendanceRecordView } from "@/types/domain";

describe("attendance operations", () => {
  it("counts every status exactly once", () => {
    const overview = computeAttendanceOverview([
      { status: "present" },
      { status: "present" },
      { status: "pending" },
      { status: "represented" },
      { status: "not_submitted" },
      { status: "absent" },
      { status: "excused" },
    ]);
    expect(overview).toMatchObject({
      total: 7,
      confirmedPresent: 2,
      pending: 1,
      represented: 1,
      notSubmitted: 1,
      absent: 1,
      excused: 1,
    });
  });

  it("only allows student submissions while a session is open", () => {
    expect(canStudentSubmit("open", "not_submitted")).toBe(true);
    expect(canStudentSubmit("open", "pending")).toBe(true);
    expect(canStudentSubmit("closed", "not_submitted")).toBe(false);
    expect(canStudentSubmit("open", "present")).toBe(false);
  });

  it("derives percentage from final statuses only", () => {
    expect(
      attendancePercentage({ present: 3, represented: 1, absent: 1, excused: 1 }),
    ).toBe(67);
    expect(attendancePercentage({ present: 0, represented: 0, absent: 0, excused: 0 })).toBe(0);
  });

  it("splits submitted and not-submitted rows", () => {
    const rows = [
      { status: "present" },
      { status: "not_submitted" },
      { status: "pending" },
    ] as AttendanceRecordView[];
    const groups = splitAttendanceRows(rows);
    expect(groups.submitted).toHaveLength(2);
    expect(groups.notSubmitted).toHaveLength(1);
  });

  it("maps database errors without leaking internals", () => {
    expect(describeAttendanceError("session is not open")).toContain("no longer open");
    expect(describeAttendanceError("requires active pe membership")).toContain("active PE roster");
    expect(describeAttendanceError("something unexpected")).toBe(
      "The attendance change could not be completed. Please try again.",
    );
  });
});

describe("task operations", () => {
  it("validates explicit audience targeting", () => {
    expect(validateAudiences([{ audience_type: "active_pe" }])).toBeNull();
    expect(validateAudiences([{ audience_type: "department" }])).toContain("Complete");
    expect(
      validateAudiences([{ audience_type: "semester", semester: 4 }]),
    ).toBeNull();
    expect(validateAudiences([])).toContain("at least one");
  });

  it("summarises audiences for admin review", () => {
    expect(
      audienceSummary([
        { audience_type: "active_pe" },
        { audience_type: "semester", semester: 6 },
      ]),
    ).toEqual(["Active PE students", "Semester 6"]);
  });

  it("derives overdue state without mutating stored status", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(displaySubmissionStatus("pending", "2026-01-01T00:00:00Z", now)).toBe("overdue");
    expect(displaySubmissionStatus("submitted", "2026-01-01T00:00:00Z", now)).toBe("submitted");
    expect(isTaskAcceptingSubmissions("published", "2026-01-01T00:00:00Z", now)).toBe(false);
    expect(isTaskAcceptingSubmissions("draft", "2027-01-01T00:00:00Z", now)).toBe(false);
  });

  it("maps file and deadline errors safely", () => {
    expect(describeTaskError("File exceeds the limit")).toContain("size limit");
    expect(describeTaskError("file type is not allowed")).toContain("not permitted");
    expect(describeTaskError("unknown")).toContain("could not be updated");
  });
});

describe("room operations", () => {
  it("calculates elapsed time and stale state", () => {
    const start = "2026-01-01T10:00:00Z";
    const now = new Date("2026-01-01T11:46:00Z");
    expect(elapsedMinutes(start, now)).toBe(106);
    expect(isStaleSession(start, 120, now)).toBe(false);
    expect(isStaleSession(start, 90, now)).toBe(true);
    expect(totalOccupancy([{}, {}, {}])).toBe(3);
  });

  it("accepts only the three room QR types", () => {
    expect(isRoomQrType("gym_room")).toBe(true);
    expect(isRoomQrType("playing_room")).toBe(true);
    expect(isRoomQrType("mental_games_room")).toBe(true);
    expect(isRoomQrType("visitor_entrance")).toBe(false);
  });

  it("maps room errors safely", () => {
    expect(describeRoomError("You already have an active session")).toContain("Scan again to exit");
    expect(describeRoomError("no active room session found")).toContain("Scan the room QR");
    expect(describeRoomError("other")).toContain("could not be updated");
  });
});

describe("visitor operations", () => {
  it("masks names for the public board", () => {
    expect(maskVisitorName("Aarav Sharma")).toBe("Aarav S.");
    expect(maskVisitorName("Aarav")).toBe("Aarav");
    expect(maskVisitorName("  ")).toBe("Visitor");
  });

  it("detects honeypot submissions", () => {
    expect(honeypotTriggered("")).toBe(false);
    expect(honeypotTriggered(null)).toBe(false);
    expect(honeypotTriggered(" bot ")).toBe(true);
  });

  it("maps visitor errors safely", () => {
    expect(describeVisitorError("invalid or inactive QR")).toContain("deactivated");
    expect(describeVisitorError("automated submission")).toContain("could not be verified");
  });
});

describe("QR configuration", () => {
  const origin = "https://pe.varsity.example";

  it("builds absolute destinations", () => {
    expect(
      buildQrDestination(`${origin}/`, "/room/", "token_1234567890abcdef"),
    ).toBe(`${origin}/room/token_1234567890abcdef`);
  });

  it("parses only same-origin PE destinations", () => {
    const target = parseQrScanValue(`${origin}/room/token_1234567890abcdef`, origin);
    expect(target).toMatchObject({ kind: "room", destination: "/room/token_1234567890abcdef" });
    expect(parseQrScanValue(`${origin}/visit/token_1234567890abcdef`, origin)?.kind).toBe("visitor");
    expect(parseQrScanValue("https://evil.example/visit/token_1234567890abcdef", origin)).toBeNull();
    expect(parseQrScanValue(`${origin}/admin/dashboard`, origin)).toBeNull();
    expect(parseQrScanValue("not-a-url", origin)).toBeNull();
  });
});

describe("file validation", () => {
  it("sanitizes filenames and keeps the extension", () => {
    expect(sanitizeFilename("../../assignment final.PDF")).toBe("assignment-final.PDF");
  });

  it("rejects dangerous and disallowed types", () => {
    expect(validateTaskFile({ filename: "answers.exe", byteSize: 100 }).ok).toBe(false);
    expect(
      validateTaskFile(
        { filename: "answers.png", byteSize: 100 },
        { allowedTypes: ["pdf"] },
      ).ok,
    ).toBe(false);
  });

  it("accepts a valid task file", () => {
    const result = validateTaskFile({
      filename: "notes.pdf",
      contentType: "application/pdf",
      byteSize: 2048,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.extension).toBe("pdf");
    expect(DEFAULT_ALLOWED_TYPES).toContain("xlsx");
    expect(humanFileSize(2048)).toBe("2 KB");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then returns a retry window", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    expect(limiter.check("ip", 1_000).allowed).toBe(true);
    expect(limiter.check("ip", 2_000).allowed).toBe(true);
    const blocked = limiter.check("ip", 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(58_000);
    expect(limiter.check("ip", 62_000).allowed).toBe(true);
  });
});

describe("India day boundaries", () => {
  it("uses IST for day strings and boundaries", () => {
    expect(istDateString("2026-01-01T18:30:00Z")).toBe("2026-01-02");
    expect(istDateString("2026-01-01T20:00:00Z")).toBe("2026-01-02");
    expect(istDayStart("2026-01-02").toISOString()).toBe("2026-01-01T18:30:00.000Z");
    expect(istDayEnd("2026-01-02").toISOString()).toBe("2026-01-02T18:30:00.000Z");
    expect(addIstDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("resolves presets against the India calendar", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(resolveDateRange("today", now).label).toContain("2026-01-15");
    expect(resolveDateRange("last_month", now).label).toBe("2025-12");
  });
});
