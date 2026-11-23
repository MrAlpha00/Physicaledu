/* VARSITY service worker — public static shell only.
 *
 * Privacy rule: no student, admin, organiser, room, attendance, visitor,
 * payment, notification, match, QR or R2 response is ever cached. Private
 * routes and all /api/ calls are network-only. Navigations are network-first
 * and, on failure, fall back to the generic offline page — never to a cached
 * user-specific HTML response.
 */
const VERSION = "varsity-shell-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const PRIVATE_PREFIXES = [
  "/api/",
  "/auth/",
  "/login",
  "/register",
  "/forgot-password",
  "/dashboard",
  "/profile",
  "/admin",
  "/classroom",
  "/tasks",
  "/scan",
  "/room",
  "/equipment",
  "/my-equipment",
  "/feedback",
  "/my-feedback",
  "/notifications",
  "/my-sports-profile",
  "/my-events",
  "/organizer",
  "/print",
  "/games/dashboard",
  "/games/challenges",
  "/games/challenge",
  "/games/history",
  "/games/profile",
  "/games/match",
];

function isPrivate(url) {
  return PRIVATE_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("varsity-shell-") && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

async function fallbackToOffline() {
  const cache = await caches.open(SHELL_CACHE);
  const offline = await cache.match(OFFLINE_URL);
  if (offline) return offline;
  return new Response("VARSITY is offline.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept, inspect or store private/auth responses.
  if (isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // HTML is deliberately never cached: even public-looking pages can
          // contain user-specific server-rendered navigation.
          return response;
        })
        .catch(() => fallbackToOffline()),
    );
    return;
  }

  const isFingerprintedAsset = url.pathname.startsWith("/_next/static/");
  const isPublicIcon =
    url.pathname.startsWith("/icons/") || url.pathname === "/favicon.ico";

  if (isFingerprintedAsset || isPublicIcon || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
