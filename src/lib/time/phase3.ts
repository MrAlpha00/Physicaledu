import { addIstDays, istDateString } from "@/lib/time/india";

/** Stable datetime-local defaults computed outside render bodies. */
export function defaultPhase3ReturnAt(days: number, hour = "17:00"): string {
  return `${addIstDays(istDateString(), days)}T${hour}`;
}
