import type { ActionState } from "@/types/domain";

export function EquipmentActionNotice({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`border-l-4 px-3 py-2 text-xs font-semibold ${
        state.status === "error"
          ? "border-l-coral bg-coral/10 text-coral-dark"
          : "border-l-[#8fb63c] bg-lime/25 text-[#33521b]"
      }`}
    >
      {state.message}
    </p>
  );
}
