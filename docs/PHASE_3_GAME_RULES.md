# Phase 3 — Game rules CMS

The game rules library is a small CMS for rules, guides and sports information.
Admins compose structured posts; the public site shows published posts only.

Admin routes: `/admin/game-rules`, `/admin/game-rules/new`,
`/admin/game-rules/[id]`. Public routes: `/game-rules`, `/game-rules/[slug]`.

## Content model

- `game_rule_categories`: name, unique URL slug, description, sort order and
  active flag. Inactive categories are hidden from public reads.
- `game_rule_posts`: title, unique slug, introduction, history, about, how to
  play, rules text, equipment, player count, playing area, instructions, safety
  instructions, up to eight video URLs, featured/pinned flags and
  `draft`/`published`/`archived` status.
- `game_rule_blocks`: ordered heading, paragraph, image, image gallery, bullet
  list, numbered instructions, rules section, quote, video embed or resource
  blocks. Blocks are replaced atomically when a post is saved.
- `phase3_files`: image/document metadata for game-rule media. This is the only
  Phase 3 parent type allowed to set `visibility = 'public'`.

## Publishing workflow

1. Create a category with a lowercase, hyphenated slug.
2. Create a post as `draft`; add structured fields and ordered blocks.
3. Upload images/documents through the private R2 flow. Mark game-rule media
   public only when it is ready to appear on a published post.
4. Set status to `published`. `published_at` is recorded on first publication.
5. Check `/game-rules` and `/game-rules/[slug]` while signed out, then pin or
   feature the post if it should appear first.
6. Use `archived` to remove a post from public pages without deleting history.

## Public exposure and privacy

| Content | Guest access |
| --- | --- |
| Active categories | Read |
| Published posts | Read |
| Blocks on published posts | Read |
| Public media attached to a published post | Presigned download |
| Drafts, archived posts, inactive categories | No access |
| Draft media or other Phase 3 files | No access |

The RLS policies and public queries both filter on `status = 'published'`.
Public media still lives in the private R2 bucket: guests receive a short-lived
presigned URL after the database confirms the file belongs to a published post.
Never enable public bucket access as a shortcut.

No student information belongs in game-rule content. Do not upload rosters,
USNs, email addresses or private feedback as media or block content.

## Manual test checklist

1. Create a draft post with an image; verify it is absent from both public
   routes and that the image cannot be downloaded by a guest.
2. Publish the post; verify title, blocks and media appear while signed out.
3. Archive it; verify both public routes stop showing it and media access ends.
4. Try a slug with spaces or uppercase letters; it must be rejected.
5. Confirm an inactive category hides its posts on the public listing.
