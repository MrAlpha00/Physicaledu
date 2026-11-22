# QR system

Phase 2 uses QR codes for the visitor register and the three PE rooms. Codes
are stored in `qr_codes` with high-entropy opaque tokens generated from 24
random bytes. Tokens are not sequential IDs.

## Code types and destinations

| Type | Theme | Destination | Used for |
| --- | --- | --- | --- |
| `visitor_entrance` | entrance | `/visit/<token>` | Public visitor register |
| `playing_room` | playing | `/room/<token>` | Playing Room entry/exit |
| `gym_room` | gym | `/room/<token>` | Gym entry/exit |
| `mental_games_room` | mental | `/room/<token>` | Mental Games Room entry/exit |
| `equipment` | equipment | — | Reserved for Phase 3; no active code |

Destinations are built from `NEXT_PUBLIC_SITE_URL` plus the stored path and
token. Set the site URL to the deployed HTTPS origin **before printing**:
printed QR codes contain an absolute URL.

## Management centre

`/admin/qr-codes` lists every code with type, destination and status. PE Admin
can:

- activate or deactivate a code;
- download a single PNG or SVG poster;
- regenerate a token in place — the previous QR stops working immediately;
- open `/admin/qr-codes/print` for an A4 print view;
- download `/api/qr/bundle` for a ZIP of all active posters.

Raw tokens are readable only by PE Admin because reprinting requires
re-rendering the poster. Public callers use `resolve_qr_token()`, which returns
only QR type, destination path, room code/name, activity requirement and theme.
Token values are never placed in client props, public components or audit logs.

## Poster generation

`/api/qr/[id]?format=svg|png` generates the poster server-side from the
admin-only token. Posters use the VARSITY palette, include a white QR quiet
zone and always render the QR pattern dark on white. `sharp` converts the SVG
to PNG. The print view embeds the SVG endpoint so raw tokens never enter browser
JavaScript. Global print CSS in `src/app/globals.css` sets A4 portrait, hides
`[data-no-print]` controls and places one poster per page.

## Student scanner

`/scan` uses `@zxing/browser` to read a QR from the camera. It requires a user
gesture to start, can be stopped, and offers a manual link/token fallback when
camera access is unavailable.

`parseQrScanValue()` only accepts URLs whose origin exactly matches the current
app origin and whose path is `/visit/<token>` or `/room/<token>`. Arbitrary
URLs, other paths and relative strings are rejected before navigation. The
token pattern is `[A-Za-z0-9_-]{16,200}`.

## Entry and exit

Visitor codes open the public form. Room codes open `/room/[token]`, where an
active PE student selects an activity if required and records entry. Scanning
the same room QR again records exit. Duplicate active sessions are prevented by
a partial unique index and an explicit RPC check. See
[ROOM_MANAGEMENT.md](ROOM_MANAGEMENT.md).

## Configuration notes

- The migration seeds one visitor code and three room codes.
- Room QR seeds link to rooms by matching `pe_rooms.code` to the QR type.
- Regeneration replaces the token in place; update all printed posters before
  removing the old ones.
- Deactivated codes fail both public resolution and trusted entry RPCs.

## Manual test checklist

1. Visit `/admin/qr-codes`; confirm four active seeded codes after migration.
2. Download a PNG and SVG; verify the QR scans to the expected same-origin URL.
3. Print the poster view; verify one poster per A4 page and a clear quiet zone.
4. Scan a code from `/scan`; verify navigation to the correct public route.
5. Scan an arbitrary URL from the manual fallback; verify rejection.
6. Regenerate one code; verify the old URL is rejected and the new poster works.
7. Deactivate a code; verify both resolution and entry are denied.
