"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GameBoard } from "@/components/games";
import {
  CountdownOverlay,
  GameNotice,
  GameResultBanner,
  ModeBadge,
  PlayerStrip,
} from "@/components/games/common";
import {
  requestRematchAction,
  setConnectionAction,
  setReadyAction,
  startMatchAction,
  submitMatchAction,
} from "@/app/(student)/games/actions";
import { matchChannelName, subscribeToChannel } from "@/lib/games/realtime";
import { engineFor } from "@/lib/games/registry";
import type { BaseState, GameSlug, MatchMode, PlayerIndex } from "@/lib/games/types";
import type { Json } from "@/types/database";

interface GameStageProps {
  slug: GameSlug;
  mode: MatchMode;
  names: [string, string];
  config: Record<string, Json>;
  initialState: Json;
  matchPublicId?: string;
  viewer?: PlayerIndex | null;
  initialStatus?: "waiting" | "countdown" | "active" | "completed" | "cancelled" | "abandoned" | "disputed";
  ready?: [boolean, boolean];
  connected?: [boolean, boolean];
  notice?: string;
}

function scoresFor(state: BaseState): [number, number] | undefined {
  const record = state as unknown as Record<string, unknown>;
  const scores = record.scores;
  if (Array.isArray(scores) && scores.length === 2 && typeof scores[0] === "number" && typeof scores[1] === "number") {
    return [scores[0], scores[1]];
  }
  return undefined;
}

export function GameStage({
  slug,
  mode,
  names,
  config,
  initialState,
  matchPublicId,
  viewer,
  initialStatus = "active",
  ready,
  connected,
  notice,
}: GameStageProps) {
  const router = useRouter();
  const engine = useMemo(() => engineFor(slug), [slug]);
  const [state, setState] = useState<Json>(initialState);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState(matchPublicId ? "connecting" : "live");
  const [countdown, setCountdown] = useState<number | null>(initialStatus === "countdown" ? 3 : null);
  const [pending, startTransition] = useTransition();
  const activeRef = useRef(status === "active");
  const lastRemoteRef = useRef({ initialState, initialStatus });
  const countdownStatusRef = useRef(status);

  // React's supported "adjust state during render" pattern keeps locally played
  // moves while adopting each authoritative snapshot delivered by the server.
  if (lastRemoteRef.current.initialState !== initialState || lastRemoteRef.current.initialStatus !== initialStatus) {
    lastRemoteRef.current = { initialState, initialStatus };
    setState(initialState);
    setStatus(initialStatus);
  }
  if (countdownStatusRef.current !== status) {
    countdownStatusRef.current = status;
    setCountdown(status === "countdown" ? 3 : null);
  }

  useEffect(() => {
    activeRef.current = status === "active";
  }, [status]);

  const base = engine.fromJson(state) as BaseState;
  const active = engine.turn(base);
  const scores = scoresFor(base);
  const isLocal = mode !== "ranked";
  const disabled = pending || (!isLocal && status !== "active") || !isLocal && viewer === null;

  const send = useCallback((type: string, payload: Record<string, Json>) => {
    setError(null);
    const current = engine.fromJson(state) as BaseState;

    if (isLocal) {
      const result = engine.apply(current as never, {
        seq: current.seq + 1,
        expectedVersion: current.version,
        actor: (current.turn ?? viewer ?? 0) as PlayerIndex,
        type,
        payload,
      } as never, config as never);
      if (!result.accepted) {
        setError(result.reason ?? "That move was rejected.");
        return;
      }
      setState(engine.toJson(result.state as never));
      setMessage(result.events.map((event) => event.message).join(" ") || null);
      if (result.state.status === "completed") setStatus("completed");
      return;
    }

    if (!matchPublicId) {
      setError("Missing match room.");
      return;
    }
    startTransition(async () => {
      const actor = viewer ?? current.turn;
      if (actor === null || actor === undefined) {
        setError("It is not your turn yet.");
        return;
      }
      const response = await submitMatchAction(matchPublicId, {
        seq: current.seq + 1,
        expectedVersion: current.version,
        actor,
        type,
        payload,
      });
      if (!response.ok) {
        setError(response.error ?? "Move rejected.");
        return;
      }
      if (response.state) setState(response.state);
      setMessage(response.events?.map((event) => event.message).join(" ") || null);
      if (response.outcome) setStatus("completed");
      router.refresh();
    });
  }, [config, engine, isLocal, matchPublicId, router, state, viewer]);

  useEffect(() => {
    if (!matchPublicId) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void subscribeToChannel(matchChannelName(matchPublicId), () => {
      if (!disposed) {
        setConnection("live");
        router.refresh();
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    }).catch(() => {
      if (!disposed) setConnection("polling");
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [matchPublicId, router]);

  useEffect(() => {
    if (!matchPublicId) return;
    void setConnectionAction(matchPublicId, true);
    const offline = () => void setConnectionAction(matchPublicId, false);
    window.addEventListener("beforeunload", offline);
    return () => {
      window.removeEventListener("beforeunload", offline);
      void setConnectionAction(matchPublicId, false);
    };
  }, [matchPublicId]);

  useEffect(() => {
    if (!matchPublicId || !["waiting", "countdown", "active"].includes(status)) return;
    const timer = window.setInterval(() => router.refresh(), 6000);
    return () => window.clearInterval(timer);
  }, [matchPublicId, router, status]);

  useEffect(() => {
    if (!matchPublicId || status !== "countdown") return;
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value === null) return null;
        if (value <= 1) {
          window.clearInterval(timer);
          void startMatchAction(matchPublicId).then(() => router.refresh());
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [matchPublicId, router, status]);

  const rematch = () => {
    if (isLocal) {
      const result = engine.apply(base as never, {
        seq: base.seq + 1,
        expectedVersion: base.version,
        actor: viewer ?? 0,
        type: "rematch",
        payload: {},
      } as never, config as never);
      if (result.accepted) {
        setState(engine.toJson(result.state as never));
        setStatus("active");
        setMessage("A fresh board is ready.");
      }
      return;
    }
    if (!matchPublicId) return;
    startTransition(async () => {
      const response = await requestRematchAction(matchPublicId);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      if (response.publicId) router.push(`/games/match/${response.publicId}`);
      else router.refresh();
    });
  };

  const viewerReady = viewer !== null && viewer !== undefined && ready ? ready[viewer] : false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge mode={mode} />
          {!isLocal && (
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">
              {connection === "live" ? "Live channel connected" : connection === "connecting" ? "Connecting…" : "Polling for updates"}
            </span>
          )}
        </div>
        {!isLocal && status === "waiting" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => {
              await setReadyAction(matchPublicId!, !viewerReady);
              router.refresh();
            })}
            className="border border-lime px-4 py-2 text-xs font-bold uppercase tracking-widest text-lime hover:bg-lime hover:text-navy disabled:opacity-50"
          >
            {viewerReady ? "Withdraw readiness" : "I'm ready"}
          </button>
        ) : null}
      </div>

      <PlayerStrip names={names} active={active} score={scores} ready={ready} connected={connected} />

      {notice ? <GameNotice title="Local play">{notice}</GameNotice> : null}
      {!isLocal && status === "waiting" ? (
        <GameNotice title="Waiting for both players">
          Both participants must mark themselves ready before the countdown begins. This page refreshes automatically when your opponent is ready.
        </GameNotice>
      ) : null}
      {!isLocal && status === "cancelled" ? <GameNotice kind="warn" title="Match cancelled">This match was cancelled and did not affect any rating.</GameNotice> : null}
      {!isLocal && status === "disputed" ? <GameNotice kind="warn" title="Dispute under review">Ratings for this match are frozen until an administrator resolves the dispute.</GameNotice> : null}

      {error ? <div className="border-l-4 border-l-coral bg-coral/10 px-4 py-3 text-sm text-coral-dark">{error}</div> : null}
      {message && !error ? <p className="text-sm text-lime">{message}</p> : null}

      <div className="relative">
        <GameBoard
          slug={slug}
          state={state}
          names={names}
          active={active}
          viewer={viewer}
          disabled={disabled}
          onAction={send}
          lastMessage={message ?? undefined}
        />
        {status === "countdown" && countdown !== null ? <CountdownOverlay seconds={countdown} /> : null}
      </div>

      <GameResultBanner
        outcome={base.outcome}
        names={names}
        onRematch={base.outcome ? rematch : undefined}
        busy={pending}
      />

      {!isLocal && base.outcome ? (
        <GameNotice kind="success" title="Result recorded">
          The result was validated on the server and applied to ranked standings. You can open a dispute from the match room if something looks wrong.
        </GameNotice>
      ) : null}
    </div>
  );
}
