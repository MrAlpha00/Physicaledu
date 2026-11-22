import { describe, expect, it } from "vitest";
import { normalizeUsn, safeNextPath } from "@/lib/utils";

describe("normalizeUsn", () => {
  it("uppercases and strips separators consistently", () => {
    expect(normalizeUsn(" 1ms21/cs-001 ")).toBe("1MS21CS001");
    expect(normalizeUsn("1ab.21_cs 002")).toBe("1AB21CS002");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeUsn("   ")).toBe("");
  });
});

describe("safeNextPath", () => {
  it("accepts application-relative paths", () => {
    expect(safeNextPath("/admin/pe-roster")).toBe("/admin/pe-roster");
  });

  it("rejects external or malformed redirects", () => {
    expect(safeNextPath("https://example.com")).toBe("/dashboard");
    expect(safeNextPath("//example.com")).toBe("/dashboard");
    expect(safeNextPath("/\\example.com")).toBe("/dashboard");
    expect(safeNextPath(null, "/login")).toBe("/login");
  });
});
