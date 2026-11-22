# Phase 3 — Reports and exports

Reports turn live Phase 1–3 records into dashboard charts, CSV files, genuine
Excel workbooks and a printable view. There are no placeholder figures.

Admin routes: `/admin/reports`, `/print/reports`. Export API:
`/api/admin/exports/phase3?dataset=<name>&format=xlsx|csv[&preset=...]` with
optional `from`/`to` ISO dates.

## Available datasets

`attendance`, `tasks`, `visitors`, `rooms`, `equipment`, `maintenance`,
`feedback`, `achievements`, `calendar`.

The admin dashboard adds live Phase 3 cards for equipment items, issued and
overdue units, open maintenance, upcoming events, open feedback, pending
achievements, unread notifications, game-rule drafts and email accepted/
webhook-delivered counts. Report charts use Recharts; workbooks use ExcelJS.

## Date windows

Windows follow Asia/Kolkata dates and reuse the Phase 2 visitor presets. A
supplied `from` or `to` value forces a custom range; otherwise the selected
preset is used and `this_month` is the default. Invalid dates fall back safely
and reversed bounds are normalised. The API and print view use the same window
resolver so a chart, file and printout agree.

## Export flow

1. PE Admin selects a dataset and window on `/admin/reports`.
2. The API checks the session and `pe_admin` role before reading any rows:
   401 when signed out, 403 without the role, 400 for a bad dataset/format.
3. `admin_log_action()` records dataset, format, row count, preset and dates.
   A failed audit aborts the download.
4. CSV is returned as UTF-8 with quoted fields. XLSX is built with a styled
   title, frozen header, autofilter and sensible column widths.
5. Responses use `Cache-Control: no-store` and an attachment filename derived
   from the dataset and IST window. `/print/reports` requires PE Admin and uses
   the same row builder.

## Privacy and operations

| Note | Detail |
| --- | --- |
| Access | Exports and print views are PE Admin only; never link them from public or student pages |
| Sensitive fields | The visitors dataset includes names and USNs; feedback/achievement exports include student names; handle files as department records |
| Caching | `no-store` on the API; no presigned URLs or secrets in report rows |
| Audit | Every export is logged with a row count; investigate unexpected bulk exports |
| Volume | Attendance and visitor queries are bounded to 20,000 rows; other datasets use the existing admin read limits. Narrow the window for big departments |

Email recipient addresses are intentionally not a report dataset. Use the
admin-only email queue when investigating delivery, and never paste addresses
into public reports.

## Manual test checklist

1. Generate each dataset as `.xlsx` and CSV; verify the file opens and headers
   match the selected window.
2. Compare one dashboard figure with the corresponding report rows.
3. Try the export API while signed out and as a student; expect 401/403.
4. Use an invalid dataset/format; expect 400 with a clear message.
5. Confirm an audit row is written and that no download occurs if the audit
   fails.
6. Print a report and verify the PE-Admin-only page is inaccessible to guests.
