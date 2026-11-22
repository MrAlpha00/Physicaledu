import type { Metadata } from "next";
import { DoorOpen, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RoomScanPanel } from "@/components/rooms/room-scan-panel";

export const metadata: Metadata = { title: "Room entry" };
export const dynamic = "force-dynamic";

export default async function RoomScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [resolutionResult, user] = await Promise.all([
    supabase.rpc("resolve_qr_token", { p_token: token }),
    getCurrentUser(),
  ]);
  const qr = resolutionResult.data?.[0];
  const validTypes = ["playing_room", "gym_room", "mental_games_room"];
  if (!qr || !validTypes.includes(qr.qr_type)) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="border-l-4 border-l-coral bg-card p-8">
          <ShieldAlert className="size-9 text-coral-dark" />
          <h1 className="mt-5 text-4xl font-bold">Invalid room QR</h1>
          <p className="mt-4 text-sm text-ink-muted">
            This QR is inactive or is not a PE room entry code. Ask the PE office for the current
            poster.
          </p>
        </div>
      </div>
    );
  }

  const roomResult = await supabase
    .from("pe_rooms")
    .select("id, name, code")
    .eq("code", qr.room_code ?? "")
    .maybeSingle();
  const room = roomResult.data;
  if (!room) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="border-l-4 border-l-coral bg-card p-8">
          <ShieldAlert className="size-9 text-coral-dark" />
          <h1 className="mt-5 text-4xl font-bold">PE access required</h1>
          <p className="mt-4 text-sm text-ink-muted">
            Room entry is available to active PE students with a verified account. Sign in with
            your VARSITY account and ensure your PE membership is active.
          </p>
        </div>
      </div>
    );
  }

  const [activitiesResult, activeResult] = await Promise.all([
    supabase
      .from("room_activities")
      .select("id, name")
      .eq("room_id", room.id)
      .eq("is_active", true)
      .order("sort_order"),
    user
      ? supabase
          .from("room_sessions")
          .select("id, room_id")
          .eq("user_id", user.id)
          .is("ended_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <div className="border-b-2 border-navy pb-6">
        <p className="eyebrow flex items-center gap-2 text-cobalt">
          <DoorOpen className="size-3" /> PE facility · Room {room.code}
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none sm:text-6xl">{room.name}</h1>
      </div>
      <div className="mt-8">
        <RoomScanPanel
          token={token}
          roomName={room.name}
          requiresActivity={Boolean(qr.requires_activity)}
          activities={(activitiesResult.data ?? []).map((activity) => ({
            id: activity.id,
            name: activity.name,
          }))}
          activeSessionId={activeResult.data?.id ?? null}
          isAuthenticated={Boolean(user)}
        />
      </div>
    </div>
  );
}
