import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/env/public";

const PROTECTED_PREFIXES = [
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
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getPublicSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // getUser() validates the token with the Auth server; never trust getSession()
  // alone for authorisation decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = hasPrefix(pathname, PROTECTED_PREFIXES);
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/print/");
  const isGuestOnly = hasPrefix(pathname, GUEST_ONLY_PATHS);

  if (!user) {
    if (isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  let isAdmin = false;
  if (isAdminRoute || isGuestOnly || pathname === "/dashboard") {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    isAdmin = Boolean(roles?.some((entry) => entry.role === "pe_admin"));
  }

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (isGuestOnly) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isAdmin ? "/admin/dashboard" : "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
