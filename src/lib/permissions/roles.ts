import type { AppRole } from "@/types/database";

export const ROLES = {
  student: "student",
  peAdmin: "pe_admin",
  eventOrganizer: "event_organizer",
} as const satisfies Record<string, AppRole>;

/** The only role that may be assigned during public self-registration. */
export const DEFAULT_REGISTRATION_ROLE: AppRole = ROLES.student;

/** Routes reserved for the PE administration team. */
export const ADMIN_ROUTE_PREFIX = "/admin";

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}

export function isPeAdminRole(roles: AppRole[]): boolean {
  return hasRole(roles, ROLES.peAdmin);
}
