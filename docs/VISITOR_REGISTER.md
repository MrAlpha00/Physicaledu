# Visitor register

The digital visitor register records entries to the PE Block. It has two
separate experiences: a public form reached from the entrance QR, and a
PE-Admin-only full register with a real Excel export.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/visit/[token]` | Public | Sign the register using the entrance QR |
| `/visitors/today` | Public | Privacy-safe list of today's visitors |
| `/admin/visitors` | PE Admin | Full records, filters, purpose tools, corrections |
| `/api/admin/visitors/export` | PE Admin | `.xlsx` download of current filters |

## Public entry flow

1. The entrance QR resolves through `public.resolve_qr_token()`. Only an active
   QR of type `visitor_entrance` is accepted.
2. The form loads active purposes and active departments. Purposes are seeded by
   the migration (`Playing sports`, `Gym`, `Mental games`, `Meeting PE Sir`,
   `Attending PE class`, `Official work`, `Other`); PE Admin can enable/disable
   or add options.
3. Signed-in users have their name, USN, department, academic year and semester
   taken from their verified profile/directory record. Guests enter their own
   name and optional details.
4. `Other` requires a purpose description. Names are 2–120 characters; guest
   USNs, when supplied, are normalised and must match `[A-Z0-9]{6,24}`.
5. The server verifies Turnstile when both keys are configured. Otherwise it
   uses a hidden honeypot field and an in-memory sliding-window rate limiter.
   The trusted `submit_visitor_entry` RPC re-checks the bot-check flag.
6. The visit is stored as a `timestamptz` instant in Asia/Kolkata terms.

No full visitor record is selectable by anonymous users. The public form only
receives the active purposes/departments and a limited QR resolution result.

## Public "today" board

`/visitors/today` calls `get_today_visitors()`, which returns only a masked
label (first name plus surname initial), purpose label and visit time for the
current India day. It never exposes full names, USNs, emails, phone numbers,
profile IDs, department IDs or raw QR tokens.

## Admin register

PE Admin can filter by India-day preset, custom date range, purpose, department
and name/USN search. The table shows the full record and identity source
(`Verified account` or `Guest entry`). Corrections add a reason and are written
to `audit_logs`; the original record is not silently overwritten.

Purpose options can be enabled, disabled or added. Disabling a purpose keeps
historic records intact; the label remains on existing rows.

## Excel export

The export button carries the current filters to
`/api/admin/visitors/export`. The route re-authenticates, checks `pe_admin`,
re-applies the filters server-side and generates a genuine `.xlsx` workbook
with:

- a branded header and the Asia/Kolkata export date;
- the selected period label and record count;
- columns for visit time, full name, USN, department, academic year, semester,
  purpose and identity/notes;
- frozen header row, autofilter and readable column widths.

The filename is `varsity-pe-visitors-YYYY-MM-DD-<preset>.xlsx`. The response is
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with
`Cache-Control: no-store`. The export is audited via `admin_log_action()` with
only the preset, range label and row count — never file contents or signed URLs.

## Privacy and abuse safeguards

- Full records are PE Admin only through RLS; there is no anonymous SELECT
  policy on `visitor_records`.
- Turnstile is optional and verified server-side when configured. Client code
  only receives the site key name value from the public env var.
- Honeypot and rate limiting are defence in depth; the RPC remains the final
  authority.
- Errors are mapped to safe user-facing messages and do not expose raw SQL.

## Manual test checklist

1. Print/scan the entrance QR and submit as a guest, then as a signed-in
   student; confirm the identity source differs.
2. Submit with a filled honeypot; confirm rejection.
3. If Turnstile is configured, confirm missing/invalid tokens are rejected.
4. Confirm `/visitors/today` shows masked labels only.
5. As a non-admin, confirm `/admin/visitors` and the export route are denied.
6. Apply filters, export, reopen in Excel/LibreOffice and verify it is a real
   workbook with the expected rows and metadata.
