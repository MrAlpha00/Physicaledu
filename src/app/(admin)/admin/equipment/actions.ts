"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canMaintenanceTransition } from "@/lib/operations/phase3";
import { istLocalInputToIso } from "@/lib/time/india";
import {
  borrowEquipmentSchema,
  equipmentAssetSchema,
  equipmentCategorySchema,
  equipmentItemSchema,
  maintenanceSchema,
  maintenanceStatusSchema,
  returnEquipmentSchema,
  stockAdjustmentSchema,
} from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refreshEquipment(itemId?: string) {
  revalidatePath("/admin/equipment");
  revalidatePath("/admin/equipment/categories");
  revalidatePath("/admin/equipment/items");
  revalidatePath("/admin/equipment/transactions");
  revalidatePath("/admin/equipment/maintenance");
  revalidatePath("/admin/dashboard");
  revalidatePath("/equipment", "layout");
  revalidatePath("/my-equipment");
  if (itemId) revalidatePath(`/admin/equipment/${itemId}`);
  revalidatePath("/admin/qr-codes");
}

function toIso(value: string | undefined): string | null {
  if (!value) return null;
  const iso = /([+-]\d{2}:\d{2}|Z)$/.test(value) ? new Date(value).toISOString() : istLocalInputToIso(value);
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export async function saveEquipmentCategory(input: {
  id?: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = equipmentCategorySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_equipment_category", {
    p_category_id: id || null,
    p_data: {
      name: data.name,
      description: data.description ?? "",
      sort_order: data.sortOrder,
      is_active: data.isActive,
    },
  });
  if (error) return { status: "error", message: error.message || "Category could not be saved." };
  refreshEquipment();
  return { status: "success", message: id ? "Category updated." : "Category created." };
}

export async function saveEquipmentItem(input: {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  identificationNumber?: string;
  trackingMode: "individual" | "bulk";
  quantity: number;
  condition: "excellent" | "good" | "fair" | "poor" | "unusable";
  storageLocation?: string;
  purchasedOn?: string;
  usefulLifeMonths?: number | "";
  notes?: string;
  imageFileId?: string;
  isActive: boolean;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = equipmentItemSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const { id, ...data } = parsed.data;
  const payload: Record<string, string | number | boolean> = {
    category_id: data.categoryId,
    name: data.name,
    description: data.description ?? "",
    identification_number: data.identificationNumber ?? "",
    tracking_mode: data.trackingMode,
    quantity: data.quantity,
    condition: data.condition,
    storage_location: data.storageLocation ?? "",
    purchased_on: data.purchasedOn ?? "",
    useful_life_months: data.usefulLifeMonths === "" ? "" : data.usefulLifeMonths ?? "",
    notes: data.notes ?? "",
    is_active: data.isActive,
  };
  if (data.imageFileId) payload.image_file_id = data.imageFileId;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_equipment_item", {
    p_item_id: id || null,
    p_data: payload,
  });
  if (error) return { status: "error", message: error.message || "Equipment item could not be saved." };
  refreshEquipment(id || undefined);
  return { status: "success", message: id ? "Equipment item updated." : "Equipment item registered." };
}

export async function createEquipmentAsset(input: {
  itemId: string;
  assetTag: string;
  serialNumber?: string;
  condition: "excellent" | "good" | "fair" | "poor" | "unusable";
  location?: string;
  notes?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = equipmentAssetSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_equipment_asset", {
    p_item_id: data.itemId,
    p_data: {
      asset_tag: data.assetTag,
      serial_number: data.serialNumber ?? "",
      condition: data.condition,
      location: data.location ?? "",
      notes: data.notes ?? "",
    },
  });
  if (error) return { status: "error", message: error.message || "Asset could not be added." };
  refreshEquipment(data.itemId);
  return { status: "success", message: "Asset added to the register." };
}

export async function adjustEquipmentStock(input: {
  itemId: string;
  quantityDelta: number;
  reason: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_equipment_stock", {
    p_item_id: parsed.data.itemId,
    p_quantity_delta: parsed.data.quantityDelta,
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: error.message || "Stock could not be adjusted." };
  refreshEquipment(parsed.data.itemId);
  return { status: "success", message: "Stock adjustment recorded." };
}

export async function issueEquipment(input: {
  itemId: string;
  assetId?: string;
  quantity: number;
  expectedReturnAt: string;
  notes?: string;
  studentDirectoryId: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const expectedReturnAt = toIso(input.expectedReturnAt);
  if (!expectedReturnAt) return { status: "error", message: "Choose a valid expected return time." };

  const parsed = borrowEquipmentSchema.safeParse({
    itemId: input.itemId,
    assetId: input.assetId,
    quantity: input.quantity,
    expectedReturnAt,
    notes: input.notes,
    studentDirectoryId: input.studentDirectoryId,
  });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  if (!parsed.data.studentDirectoryId) {
    return { status: "error", message: "Choose an active PE student." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("borrow_equipment", {
    p_item_id: parsed.data.itemId,
    p_asset_id: parsed.data.assetId || null,
    p_quantity: parsed.data.quantity,
    p_expected_return_at: parsed.data.expectedReturnAt,
    p_notes: parsed.data.notes || null,
    p_student_directory_id: parsed.data.studentDirectoryId,
  });
  if (error) return { status: "error", message: error.message || "Equipment could not be issued." };
  refreshEquipment(parsed.data.itemId);
  return { status: "success", message: "Equipment issued and student record updated." };
}

export async function adminReturnEquipment(input: {
  transactionId: string;
  quantity: number;
  condition: "excellent" | "good" | "fair" | "poor" | "unusable";
  damageIndicator: boolean;
  notes?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = returnEquipmentSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_equipment", {
    p_transaction_id: parsed.data.transactionId,
    p_quantity: parsed.data.quantity,
    p_condition: parsed.data.condition,
    p_damage_indicator: parsed.data.damageIndicator,
    p_notes: parsed.data.notes || null,
  });
  if (error) return { status: "error", message: error.message || "Return could not be recorded." };
  refreshEquipment();
  return { status: "success", message: "Return recorded." };
}

const correctionSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(5, "Give a reason for the correction").max(300),
  expectedReturnAt: z.string().optional(),
});

export async function correctEquipmentTransaction(input: {
  transactionId: string;
  reason: string;
  expectedReturnAt?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const expectedReturnAt = parsed.data.expectedReturnAt
    ? toIso(parsed.data.expectedReturnAt)
    : null;
  if (parsed.data.expectedReturnAt && !expectedReturnAt) {
    return { status: "error", message: "Choose a valid corrected return time." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_correct_equipment_transaction", {
    p_transaction_id: parsed.data.transactionId,
    p_reason: parsed.data.reason,
    p_expected_return_at: expectedReturnAt,
  });
  if (error) return { status: "error", message: error.message || "Correction could not be saved." };
  refreshEquipment();
  return { status: "success", message: "Transaction corrected and audit entry recorded." };
}

export async function saveMaintenance(input: {
  id?: string;
  itemId: string;
  assetId?: string;
  issueDescription: string;
  maintenanceType: "damage" | "fault" | "repair" | "inspection" | "other";
  quantityAffected: number;
  assignedPerson?: string;
  scheduledFor?: string;
  expectedCompletionAt?: string;
  notes?: string;
  sourceFeedbackId?: string;
  status?: "reported" | "under_review" | "scheduled" | "in_progress";
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const { id, ...data } = parsed.data;
  const scheduledFor = toIso(data.scheduledFor);
  const expectedCompletionAt = toIso(data.expectedCompletionAt);
  if ((data.scheduledFor && !scheduledFor) || (data.expectedCompletionAt && !expectedCompletionAt)) {
    return { status: "error", message: "Choose valid maintenance dates." };
  }

  const payload: Record<string, string | number | boolean> = {
    item_id: data.itemId,
    asset_id: data.assetId ?? "",
    issue_description: data.issueDescription,
    maintenance_type: data.maintenanceType,
    quantity_affected: data.quantityAffected,
    assigned_person: data.assignedPerson ?? "",
    scheduled_for: scheduledFor ?? "",
    expected_completion_at: expectedCompletionAt ?? "",
    notes: data.notes ?? "",
    source_feedback_id: data.sourceFeedbackId ?? "",
    status: data.status,
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_equipment_maintenance", {
    p_record_id: id || null,
    p_data: payload,
  });
  if (error) return { status: "error", message: error.message || "Maintenance record could not be saved." };
  refreshEquipment(data.itemId);
  return { status: "success", message: id ? "Maintenance record updated." : "Maintenance reported." };
}

export async function setMaintenanceStatus(input: {
  recordId: string;
  status:
    | "reported"
    | "under_review"
    | "scheduled"
    | "in_progress"
    | "completed"
    | "unrepairable"
    | "cancelled";
  resolutionNotes?: string;
  cost?: number | "";
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = maintenanceStatusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("equipment_maintenance_records")
    .select("status")
    .eq("id", parsed.data.recordId)
    .maybeSingle();
  if (!current) return { status: "error", message: "Maintenance record not found." };
  if (!canMaintenanceTransition(current.status, parsed.data.status)) {
    return { status: "error", message: "That status change is not allowed." };
  }

  const { error } = await supabase.rpc("admin_set_equipment_maintenance_status", {
    p_record_id: parsed.data.recordId,
    p_status: parsed.data.status,
    p_resolution_notes: parsed.data.resolutionNotes || null,
    p_cost: parsed.data.cost === "" ? null : parsed.data.cost ?? null,
  });
  if (error) return { status: "error", message: error.message || "Status could not be changed." };
  refreshEquipment();
  return { status: "success", message: "Maintenance status updated." };
}

const qrSchema = z.object({
  name: z.string().trim().min(2, "Enter a QR name").max(80),
  itemId: z.string().uuid(),
  assetId: z.string().uuid().or(z.literal("")).optional(),
});

export async function createEquipmentQr(input: {
  name: string;
  itemId: string;
  assetId?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = qrSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_equipment_qr", {
    p_name: parsed.data.name,
    p_item_id: parsed.data.itemId,
    p_asset_id: parsed.data.assetId || null,
  });
  if (error) return { status: "error", message: error.message || "QR code could not be created." };
  refreshEquipment(parsed.data.itemId);
  return { status: "success", message: "Equipment QR created. Print it from the QR management page." };
}
