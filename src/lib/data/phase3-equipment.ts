import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  displayEquipmentTransactionStatus,
  equipmentInventoryStatus,
} from "@/lib/operations/phase3";
import type {
  EquipmentAssetView,
  EquipmentCategoryView,
  EquipmentItemView,
  EquipmentMaintenanceView,
  EquipmentQrResult,
  EquipmentTransactionView,
} from "@/types/domain";

export const getEquipmentCategories = cache(async (): Promise<EquipmentCategoryView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_categories")
    .select("id, name, description, sort_order, is_active")
    .order("sort_order")
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
});

export const getEquipmentItems = cache(async (): Promise<EquipmentItemView[]> => {
  const supabase = await createClient();
  const [itemsResult, categoriesResult, assetsResult] = await Promise.all([
    supabase.from("equipment_items").select("*").order("name"),
    supabase.from("equipment_categories").select("id, name"),
    supabase.from("equipment_assets").select("id, item_id"),
  ]);

  const categoryNames = new Map((categoriesResult.data ?? []).map((row) => [row.id, row.name]));
  const assetCounts = new Map<string, number>();
  (assetsResult.data ?? []).forEach((row) => {
    assetCounts.set(row.item_id, (assetCounts.get(row.item_id) ?? 0) + 1);
  });

  return (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: categoryNames.get(row.category_id) ?? "Uncategorised",
    name: row.name,
    description: row.description,
    identificationNumber: row.identification_number,
    trackingMode: row.tracking_mode,
    quantity: row.quantity,
    availableQuantity: row.available_quantity,
    borrowedQuantity: row.borrowed_quantity,
    maintenanceQuantity: row.maintenance_quantity,
    damagedQuantity: row.damaged_quantity,
    retiredQuantity: row.retired_quantity,
    inventoryStatus: equipmentInventoryStatus(row),
    condition: row.condition,
    storageLocation: row.storage_location,
    purchasedOn: row.purchased_on,
    usefulLifeMonths: row.useful_life_months,
    isActive: row.is_active,
    assetCount: assetCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
  }));
});

export async function getEquipmentAssets(itemId?: string): Promise<EquipmentAssetView[]> {
  const supabase = await createClient();
  let query = supabase.from("equipment_assets").select("*").order("asset_tag");
  if (itemId) query = query.eq("item_id", itemId);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    condition: row.condition,
    status: row.status,
    location: row.location,
    notes: row.notes,
  }));
}

async function mapTransactions(
  transactions: Awaited<ReturnType<typeof fetchRawTransactions>>,
): Promise<EquipmentTransactionView[]> {
  if (transactions.length === 0) return [];
  const supabase = await createClient();
  const itemIds = [...new Set(transactions.map((row) => row.item_id))];
  const studentIds = [...new Set(transactions.map((row) => row.student_directory_id))];
  const [itemsResult, studentsResult, assetsResult] = await Promise.all([
    supabase.from("equipment_items").select("id, name").in("id", itemIds),
    supabase.from("student_directory").select("id, full_name").in("id", studentIds),
    supabase.from("equipment_assets").select("id, asset_tag").in("id", transactions.flatMap((row) => (row.asset_id ? [row.asset_id] : []))),
  ]);

  const itemNames = new Map((itemsResult.data ?? []).map((row) => [row.id, row.name]));
  const studentNames = new Map((studentsResult.data ?? []).map((row) => [row.id, row.full_name]));
  const assetTags = new Map((assetsResult.data ?? []).map((row) => [row.id, row.asset_tag]));

  return transactions.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: itemNames.get(row.item_id) ?? "Equipment",
    assetId: row.asset_id,
    assetTag: row.asset_id ? assetTags.get(row.asset_id) ?? null : null,
    studentDirectoryId: row.student_directory_id,
    studentName: studentNames.get(row.student_directory_id) ?? "Student",
    quantityIssued: row.quantity_issued,
    quantityReturned: row.quantity_returned,
    issuedAt: row.issued_at,
    expectedReturnAt: row.expected_return_at,
    displayStatus: displayEquipmentTransactionStatus(row),
    damageIndicator: row.damage_indicator,
    notes: row.notes,
    returnNotes: row.return_notes,
    correctionReason: row.correction_reason,
  }));
}

async function fetchRawTransactions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_transactions")
    .select("*")
    .order("issued_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

export const getEquipmentTransactions = cache(async (): Promise<EquipmentTransactionView[]> => {
  return mapTransactions(await fetchRawTransactions());
});

export const getMyEquipmentTransactions = cache(async (): Promise<EquipmentTransactionView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_transactions")
    .select("*")
    .order("issued_at", { ascending: false })
    .limit(200);
  return mapTransactions(data ?? []);
});

export const getMaintenanceRecords = cache(async (): Promise<EquipmentMaintenanceView[]> => {
  const supabase = await createClient();
  const [recordsResult, itemsResult] = await Promise.all([
    supabase.from("equipment_maintenance_records").select("*").order("reported_at", { ascending: false }).limit(500),
    supabase.from("equipment_items").select("id, name"),
  ]);
  const itemNames = new Map((itemsResult.data ?? []).map((row) => [row.id, row.name]));
  return (recordsResult.data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: itemNames.get(row.item_id) ?? "Equipment",
    assetId: row.asset_id,
    issueDescription: row.issue_description,
    maintenanceType: row.maintenance_type,
    quantityAffected: row.quantity_affected,
    reportedAt: row.reported_at,
    assignedPerson: row.assigned_person,
    scheduledFor: row.scheduled_for,
    expectedCompletionAt: row.expected_completion_at,
    completedAt: row.completed_at,
    status: row.status,
    resolutionNotes: row.resolution_notes,
    cost: row.cost === null ? null : Number(row.cost),
  }));
});

export async function resolveEquipmentQrToken(token: string): Promise<EquipmentQrResult | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_equipment_qr", { p_token: token });
  const row = data?.[0];
  if (!row) return null;
  return {
    qrId: row.qr_id,
    itemId: row.item_id,
    assetId: row.asset_id,
    itemName: row.item_name,
    trackingMode: row.tracking_mode,
    availableQuantity: row.available_quantity,
    assetTag: row.asset_tag,
    condition: row.condition,
    theme: row.theme,
  };
}

export interface EquipmentMetrics {
  totalItems: number;
  availableItems: number;
  issuedQuantity: number;
  overdueTransactions: number;
  openMaintenance: number;
  damagedQuantity: number;
}

export const getEquipmentMetrics = cache(async (): Promise<EquipmentMetrics> => {
  const [items, transactions, maintenance] = await Promise.all([
    getEquipmentItems(),
    getEquipmentTransactions(),
    getMaintenanceRecords(),
  ]);
  return {
    totalItems: items.length,
    availableItems: items.reduce((sum, item) => sum + item.availableQuantity, 0),
    issuedQuantity: items.reduce((sum, item) => sum + item.borrowedQuantity, 0),
    overdueTransactions: transactions.filter((item) => item.displayStatus === "overdue").length,
    openMaintenance: maintenance.filter((item) => !["completed", "unrepairable", "cancelled"].includes(item.status)).length,
    damagedQuantity: items.reduce((sum, item) => sum + item.damagedQuantity, 0),
  };
});
