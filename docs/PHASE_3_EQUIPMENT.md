# Phase 3 — Equipment inventory and loans

The equipment store manages PE-owned items, individual assets, bulk stock,
issue/return transactions, damage, maintenance and printable QR labels. The
ledger is the source of truth; QR posters are an entry point, not a separate
inventory.

Admin routes: `/admin/equipment` (overview), `/admin/equipment/categories`,
`/admin/equipment/items`, `/admin/equipment/transactions`,
`/admin/equipment/maintenance`, `/admin/equipment/[itemId]`.
Student routes: `/equipment`, `/equipment/[token]`, `/my-equipment`.
The existing `/admin/qr-codes` and `/admin/qr-codes/print` screens render the
equipment QR theme and posters.

## Data model

| Table | Purpose |
| --- | --- |
| `equipment_categories` | Named, sortable, activatable categories |
| `equipment_items` | Item definition, tracking mode, stock buckets, condition, location, photo |
| `equipment_assets` | Individual tagged assets for `individual` tracking |
| `equipment_transactions` | One issue per row; expected return, condition, status and corrections |
| `equipment_return_records` | Partial or complete returns with condition and damage flag |
| `equipment_stock_adjustments` | Reasoned bulk-stock changes |
| `equipment_maintenance_records` | Faults, repairs, inspections, cost and terminal states |
| `equipment_qr_links` | Active equipment QR code to item/asset mapping |
| `phase3_files` | Private metadata for item photos and maintenance photos |

Stock buckets are `available`, `borrowed`, `maintenance`, `damaged` and
`retired`. Bulk items must satisfy
`available + borrowed + maintenance + damaged + retired = quantity`; individual
items may register assets as they are added. New individual items start with
zero available units until assets are tagged.

## Workflows

### Set up an item

1. Create an active category.
2. Create an item with a tracking mode: `individual` for tagged assets, `bulk`
   for countable stock. Tracking mode cannot be changed later.
3. For individual items, register one asset per physical unit with a unique
   asset tag. For bulk items, set the quantity and use reasoned stock
   adjustments only.
4. Optionally attach a private image through the Phase 3 upload flow.
5. Print an equipment QR poster for the item or a specific asset.

### Issue and return

1. PE Admin issues for a chosen student, or an active PE student borrows for
   themselves from `/equipment` or a scanned `/equipment/[token]` poster.
2. Individual assets are borrowed one at a time; bulk items may borrow multiple
   units up to available stock. A future expected return time is required.
3. A return may be partial. Returning a damaged or unusable unit moves it into
   the damaged bucket; otherwise it returns to available stock.
4. Overdue status is derived from expected return time for open loans. PE Admin
   can correct the due date/status with a mandatory reason.
5. Students see only their own transactions and return records. Admins see all.

Issue, return, correction, maintenance and QR creation actions are audited via
`phase3_log()`.

### Maintenance

1. Create a maintenance record from an item or from a feedback request
   (`source_feedback_id`). Reported units move from available to maintenance.
2. Advance through `reported`, `under_review`, `scheduled`, `in_progress` to a
   terminal state: `completed`, `unrepairable` or `cancelled`.
3. Completion returns units to available stock; unrepairable units move to
   damaged. Terminal records cannot be reopened.
4. Costs are optional, non-negative and record the authorising admin.

## Operational runbook

- Daily: check `/admin/equipment/transactions` for overdue loans and follow up
  with the student; check `/admin/equipment/maintenance` for open faults.
- Before an event: confirm category/item active flags, available quantities and
  that the QR poster still resolves to active equipment.
- After an event: reconcile returns, record damage and convert any equipment
  feedback into a maintenance record where useful.
- Stock corrections: use `admin_adjust_equipment_stock()` for bulk only with a
  non-zero delta and written reason; manage individual units in the asset
  register. Never edit stock buckets directly.
- QR problems: deactivate the old poster in the QR centre and print a fresh one;
  `resolve_equipment_qr()` only returns active codes linked to active items.

## Permissions and privacy

| Action | Student | PE Admin |
| --- | --- | --- |
| Read active categories/items/assets | Yes | Yes |
| Borrow own equipment | Yes, active PE only | Yes, for a selected student |
| Read transactions | Own only | All |
| Return | Own open loans | Any open loan |
| Issue, correct, adjust stock, maintain, create QR | No | Yes |

QR tokens are high-entropy and are not exposed in student lists. No equipment
page is public; student directory IDs are used internally and are not shown as
contact details. Photos and maintenance evidence remain private Phase 3 files.

## Manual test checklist

1. Create a category, bulk item and individual item with two tagged assets.
2. Borrow bulk stock as a student, partially return it, then complete the return.
3. Scan an equipment poster and borrow/return a tagged asset.
4. Try to borrow unavailable or inactive equipment; it must be rejected.
5. Report maintenance from an item and from feedback; close as completed and
   unrepairable and verify stock buckets.
6. Confirm a stock adjustment requires a reason and cannot make stock negative.
7. Sign out and confirm no equipment route or metadata is publicly readable.
