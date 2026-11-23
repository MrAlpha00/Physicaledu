# Final UAT

## Status

Not executed in a real browser/device or against live services in this pass. Use this checklist for owner/UAT execution.

## Public

- [ ] Home/public pages load and are responsive.
- [ ] Public nav works on mobile.
- [ ] Public info, events, game rules, visitors today, games pages load.
- [ ] No private data exposed.

## Auth/profile

- [ ] Register, login, forgot/reset password, logout.
- [ ] Profile loads and updates as allowed.
- [ ] Unauthorized access redirected/denied.

## Admin/staff

- [ ] Admin dashboard and nav links work.
- [ ] Students, departments, PE roster, classroom, tasks, attendance, QR, rooms, visitors.
- [ ] Equipment, calendar, feedback, game rules CMS, sports profiles, reports.
- [ ] Events/tournaments/organizers/payments.
- [ ] Games admin/moderation/ratings.

## Student

- [ ] Dashboard, classroom, attendance, tasks, scan QR, equipment, calendar, feedback, notifications.
- [ ] Games dashboard/challenges/history/profile/match.
- [ ] My events, my equipment, my feedback, my sports profile, organizer area if assigned.

## Games/timeouts

- [ ] Create/start/play/complete match.
- [ ] Ranked result updates once.
- [ ] Expired chess clock finalizes correctly.
- [ ] Abandoned non-chess finalizes by grace/connection rule.
- [ ] No duplicate ratings/results.

## PWA

- [ ] Install prompt/A2HS guidance.
- [ ] Offline fallback on navigation failure.
- [ ] No private data in Cache Storage.
- [ ] Update prompt appears and does not interrupt active match/form.

## Security/ops

- [ ] Health endpoint returns no secrets.
- [ ] Cron endpoint rejects missing/bad secret.
- [ ] R2 uploads/downloads authorized.
- [ ] Backups/restore tested in scratch.
