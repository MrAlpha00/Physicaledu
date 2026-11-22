# Phase 3 — Student sports profiles

Students maintain an opt-in sports profile and suggest achievements. PE Admins
verify or reject suggestions and record official achievements. Only verified
achievements can appear on an explicitly public profile.

Student route: `/my-sports-profile`. Admin route: `/admin/sports-profiles`.
Public route: `/sports-profile/[student]` where `[student]` is a student
directory UUID.

## Data model

| Table | Purpose |
| --- | --- |
| `sports_profile_details` | One row per user: biography, interests, preferred sports, photo, `is_public` |
| `sports_achievements` | Title, sport, event, year, date, result, evidence and verification state |
| `sports_participation_records` | Verified participation from attendance/class tasks, plus manual and future sources |

`is_public` defaults to **false**. Student-created achievements default to
`verification_status = 'pending'`; only PE Admin verification sets `verified`
with `verified_by` and `verified_at`. Rejected entries remain in the record for
audit history. Evidence files are private Phase 3 uploads.

Participation records are maintained by triggers after reviewed attendance
(`present`/`represented`) and reviewed/completed class tasks. They are for
internal reporting; they are not published on the public profile.

## Student workflow

1. Open `/my-sports-profile` and edit biography, interests and preferred sports.
2. Enable `is_public` only if the student wants a public page.
3. Suggest an achievement with title, sport, event details and optional
   evidence. The entry stays pending until reviewed.
4. Track verification status and the admin's verification note in the student
   view. Pending entries are never served publicly.

## Admin workflow

1. Review `/admin/sports-profiles`, filtering pending achievements.
2. Check the evidence file through the authorised private download flow.
3. Verify, reject or record an official achievement. Corrections require a
   verification note where appropriate.
4. Confirm that a verified achievement appears only on an opted-in public
   profile and that rejected/pending entries do not.

Review and official-record actions write to `audit_logs` via `phase3_log()`.

## Public projection

`get_public_sports_profile()` returns only: full name, department name,
academic year, semester, biography, preferred sports, sports interests and
**verified** achievements. It requires an active linked profile with
`is_public = true` and an active directory record.

The public page never includes USN, email, contact details, verification notes,
pending or rejected achievements, private profile fields, participation records,
evidence files or the profile photo. Guests who are not entitled to a profile see
a neutral “not public” state. Profile photos stay private: the upload RPC/RLS
allows only the uploader or a PE Admin to download them, and public profile pages
never expose the image file. Keep the R2 bucket private.

## Manual test checklist

1. As a student, save a private profile and suggest an achievement with
   evidence; confirm it is pending.
2. Confirm `/sports-profile/[directory-id]` shows “not public” before opt-in.
3. Enable public visibility as the student; confirm pending achievement is still
   absent.
4. As PE Admin, verify the achievement; confirm it appears publicly and the
   evidence remains private.
5. Reject another suggestion and confirm it never appears publicly.
6. Confirm the public RPC/page contains no USN, email or participation data.
