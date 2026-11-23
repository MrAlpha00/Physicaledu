# PWA installation

## What is implemented

- Web manifest: `src/app/manifest.ts` (`/manifest.webmanifest`).
- Original VARSITY icons: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, favicons, and branded screenshots.
- Service worker: `public/sw.js`, registered by `src/components/pwa/pwa-manager.tsx` in production.
- Offline fallback: `src/app/offline/page.tsx`.
- Install guidance: in-app install prompt where supported; iOS Safari gets Add to Home Screen guidance.

## Privacy/caching policy

The service worker caches only public static shell assets:

- `/_next/static/*` fingerprinted assets
- `/icons/*`, `/manifest.webmanifest`
- `/offline` fallback

It never caches or queues:

- `/api/*`, auth routes, admin/student/private routes
- attendance, profiles, visitors, payment proofs, R2 objects, notifications, tokens, private rooms
- game moves, match state mutations, or form submissions

Navigations are network-first and fall back to the generic offline page only on network failure. HTML responses are not cached.

## Install

### Android/Chrome/Edge

1. Open the deployed HTTPS site.
2. Use the in-app Install button when shown, or browser menu > Install app/Add to Home screen.
3. Launch VARSITY from the home screen/app launcher.

### iOS Safari

1. Open the deployed HTTPS site in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Confirm. iOS does not expose a direct install button to web apps.

## Update flow

When a new service worker is waiting, the app shows a non-intrusive "Apply update" prompt. It does not auto-reload during active use; users should finish matches/forms before applying.

## Local verification

```bash
npm run build
npm run start
```

Then in Chrome DevTools: Application > Manifest, Service Workers, Cache Storage. Confirm only public shell assets are cached and private routes are network-only.

## Owner action / limitations

- Real install testing requires HTTPS deployment or supported localhost setup and a real browser/device.
- iOS behavior must be verified on a real device.
- This local pass did not perform browser/device install testing.
