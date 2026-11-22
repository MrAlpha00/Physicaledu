import { describe, expect, it } from "vitest";
import {
  aggregateReportRows,
  audienceLabel,
  canBulkBorrow,
  canFeedbackTransition,
  canMaintenanceTransition,
  displayEquipmentTransactionStatus,
  equipmentInventoryStatus,
  expandCalendarOccurrences,
  percentage,
  planEmailBatch,
  remainingEmailCapacity,
} from "@/lib/operations/phase3";
import { buildQrDestination, parseQrScanValue } from "@/lib/qr/qr-config";
import type {
  Phase3CalendarEventRow,
  Phase3CalendarOverrideRow,
  Phase3EquipmentItemRow,
  Phase3EquipmentTransactionRow,
  Phase3RecurrenceRuleRow,
} from "@/types/database";

const NOW = new Date("2026-11-23T06:00:00.000Z");

function item(overrides: Partial<Phase3EquipmentItemRow> = {}): Phase3EquipmentItemRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category_id: "22222222-2222-4222-8222-222222222222",
    name: "Cricket bat",
    description: null,
    identification_number: "BAT-01",
    tracking_mode: "bulk",
    quantity: 10,
    available_quantity: 10,
    borrowed_quantity: 0,
    maintenance_quantity: 0,
    damaged_quantity: 0,
    retired_quantity: 0,
    condition: "good",
    storage_location: "Store A",
    purchased_on: null,
    useful_life_months: null,
    notes: null,
    image_file_id: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(overrides: Partial<Phase3EquipmentTransactionRow> = {}): Phase3EquipmentTransactionRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    item_id: item().id,
    asset_id: null,
    student_directory_id: "44444444-4444-4444-8444-444444444444",
    quantity_issued: 1,
    quantity_returned: 0,
    issued_at: "2026-11-01T04:00:00.000Z",
    expected_return_at: "2026-11-20T04:00:00.000Z",
    issued_by: null,
    issue_condition: "good",
    notes: null,
    status: "issued",
    returned_at: null,
    received_by: null,
    return_condition: null,
    damage_indicator: false,
    return_notes: null,
    correction_reason: null,
    created_at: "2026-11-01T04:00:00.000Z",
    updated_at: "2026-11-01T04:00:00.000Z",
    ...overrides,
  };
}

function calendarEvent(overrides: Partial<Phase3CalendarEventRow> = {}): Phase3CalendarEventRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    title: "PE practice",
    description: null,
    category: "sports_practice",
    starts_at: "2026-11-23T04:00:00.000Z",
    ends_at: "2026-11-23T05:30:00.000Z",
    venue: "Ground",
    visibility: "pe_only",
    status: "published",
    is_recurring: true,
    attachment_file_id: null,
    created_by: null,
    published_at: "2026-11-01T00:00:00.000Z",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function rule(overrides: Partial<Phase3RecurrenceRuleRow> = {}): Phase3RecurrenceRuleRow {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    event_id: calendarEvent().id,
    frequency: "daily",
    interval_count: 1,
    by_weekday: null,
    ends_on: null,
    occurrence_limit: 5,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function override(overrides: Partial<Phase3CalendarOverrideRow> = {}): Phase3CalendarOverrideRow {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    rule_id: rule().id,
    occurrence_starts_at: "2026-11-24T04:00:00.000Z",
    is_cancelled: false,
    title: null,
    starts_at: null,
    ends_at: null,
    venue: null,
    description: null,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 3 equipment operations", () => {
  it("derives inventory status from stock buckets", () => {
    expect(equipmentInventoryStatus(item())).toBe("available");
    expect(equipmentInventoryStatus(item({ available_quantity: 0, borrowed_quantity: 10 }))).toBe("fully_borrowed");
    expect(equipmentInventoryStatus(item({ maintenance_quantity: 10, available_quantity: 0 }))).toBe("under_maintenance");
    expect(equipmentInventoryStatus(item({ is_active: false }))).toBe("unavailable");
  });

  it("marks open issues overdue without mutating the stored status", () => {
    const open = transaction();
    expect(displayEquipmentTransactionStatus(open, NOW)).toBe("overdue");
    expect(open.status).toBe("issued");
    expect(displayEquipmentTransactionStatus(transaction({ status: "returned" }), NOW)).toBe("returned");
    expect(
      displayEquipmentTransactionStatus(transaction({ expected_return_at: "2026-12-01T04:00:00.000Z" }), NOW),
    ).toBe("issued");
  });

  it("only bulk-borrows active items with enough stock", () => {
    expect(canBulkBorrow(item(), 3)).toBe(true);
    expect(canBulkBorrow(item(), 11)).toBe(false);
    expect(canBulkBorrow(item({ tracking_mode: "individual" }), 1)).toBe(false);
  });
});

describe("Phase 3 calendar operations", () => {
  it("expands a bounded daily rule and applies overrides", () => {
    const occurrences = expandCalendarOccurrences(
      calendarEvent(),
      rule({ occurrence_limit: 4 }),
      [
        override({ is_cancelled: true }),
        override({
          occurrence_starts_at: "2026-11-25T04:00:00.000Z",
          title: "Inter-house practice",
          venue: "Main field",
        }),
      ],
      new Date("2026-11-23T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z"),
    );

    expect(occurrences.map((entry) => entry.startsAt)).toEqual([
      "2026-11-23T04:00:00.000Z",
      "2026-11-25T04:00:00.000Z",
      "2026-11-26T04:00:00.000Z",
      "2026-11-27T04:00:00.000Z",
    ]);
    expect(occurrences[1]).toMatchObject({
      title: "Inter-house practice",
      venue: "Main field",
      isOverride: true,
      isCancelled: false,
    });
  });

  it("never persists or returns more than the occurrence cap", () => {
    const occurrences = expandCalendarOccurrences(
      calendarEvent(),
      rule({ occurrence_limit: 260, ends_on: null }),
      [],
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2027-12-31T00:00:00.000Z"),
      20,
    );
    expect(occurrences).toHaveLength(20);
  });

  it("does not expand draft or non-recurring events", () => {
    const single = calendarEvent({ is_recurring: false });
    const windowStart = new Date("2026-11-23T00:00:00.000Z");
    const windowEnd = new Date("2026-12-30T00:00:00.000Z");
    expect(expandCalendarOccurrences(single, rule(), [], windowStart, windowEnd)).toHaveLength(1);
    const draft = calendarEvent({ status: "draft" });
    expect(expandCalendarOccurrences(draft, rule(), [], windowStart, windowEnd)).toHaveLength(1);
  });
});

describe("Phase 3 email queue operations", () => {
  it("caps daily sends at the smaller of the app limit and daily setting", () => {
    expect(remainingEmailCapacity(40, 100)).toBe(60);
    expect(remainingEmailCapacity(95, 50)).toBe(0);
  });

  it("plans bounded batches and skips exhausted recipients", () => {
    const pending = [
      { id: "a", attempts: 0 },
      { id: "b", attempts: 2 },
      { id: "c", attempts: 3 },
      { id: "d", attempts: 0 },
    ];
    expect(planEmailBatch(pending, 100, 25)).toEqual(["a", "b", "d"]);
    expect(planEmailBatch(pending, 1, 25)).toEqual(["a"]);
    expect(planEmailBatch(pending, 100, 99)).toHaveLength(3);
  });
});

describe("Phase 3 shared operations", () => {
  it("blocks terminal maintenance and closed feedback transitions", () => {
    expect(canMaintenanceTransition("reported", "in_progress")).toBe(true);
    expect(canMaintenanceTransition("completed", "reported")).toBe(false);
    expect(canFeedbackTransition("submitted", "resolved")).toBe(true);
    expect(canFeedbackTransition("closed", "submitted")).toBe(false);
  });

  it("formats audience labels and aggregates report rows deterministically", () => {
    expect(audienceLabel({ audienceType: "semester", semester: 4 })).toBe("Semester 4");
    expect(audienceLabel({ audienceType: "active_pe" })).toBe("Active PE students");
    expect(aggregateReportRows([{ label: "b", value: 2 }, { label: "a", value: 3 }, { label: "b", value: 1 }])).toEqual([
      { label: "a", value: 3, detail: null },
      { label: "b", value: 3, detail: null },
    ]);
    expect(percentage(1, 8)).toBe(12.5);
    expect(percentage(3, 0)).toBe(0);
  });
});

describe("Phase 3 equipment QR parsing", () => {
  it("builds and parses only allowlisted equipment URLs", () => {
    const token = "abcdefghijklmnop1234567890";
    const destination = buildQrDestination("https://varsity.example", "/equipment", token);
    expect(parseQrScanValue(destination, "https://varsity.example")).toEqual({
      kind: "equipment",
      token,
      destination: `/equipment/${token}`,
    });
    expect(parseQrScanValue("https://evil.example/equipment/" + token, "https://varsity.example")).toBeNull();
    expect(parseQrScanValue("https://varsity.example/equipment/short", "https://varsity.example")).toBeNull();
  });
});
