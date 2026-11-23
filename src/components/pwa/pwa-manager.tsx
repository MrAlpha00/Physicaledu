"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Native install prompt, iOS guidance, offline indicator and controlled updates.
 * Nothing is auto-reloaded: an active match or form submission is never interrupted.
 */
export function PwaManager() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const [updateWaiting, setUpdateWaiting] = useState<ServiceWorker | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setOffline(!navigator.onLine);

    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosTip(false);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIosBrowser() && !isStandalone() && !sessionStorage.getItem("varsity-ios-tip-dismissed")) {
      setShowIosTip(true);
    }

    let registration: ServiceWorkerRegistration | null = null;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registered) => {
          registration = registered;
          if (registered.waiting) setUpdateWaiting(registered.waiting);
          registered.addEventListener("updatefound", () => {
            const worker = registered.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateWaiting(worker);
              }
            });
          });
        })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      void registration;
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowIosTip(false);
    }
    setInstallEvent(null);
  }, [installEvent]);

  const applyUpdate = useCallback(async () => {
    if (!updateWaiting) return;
    setUpdateBusy(true);
    updateWaiting.postMessage("SKIP_WAITING");
    // Give the waiting worker a moment to activate before refreshing.
    await new Promise((resolve) => setTimeout(resolve, 250));
    window.location.reload();
  }, [updateWaiting]);

  const dismissIosTip = useCallback(() => {
    sessionStorage.setItem("varsity-ios-tip-dismissed", "1");
    setShowIosTip(false);
  }, []);

  if (!offline && !installEvent && !showIosTip && !updateWaiting && installed) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-end gap-2 px-4 sm:bottom-4 sm:px-6"
      aria-live="polite"
      data-no-print
    >
      {offline ? (
        <div className="pointer-events-auto flex items-center gap-2 border border-navy/15 bg-navy px-4 py-3 text-xs font-bold text-chalk shadow-xl">
          <WifiOff className="size-4 text-lime" aria-hidden />
          Offline — live records and matches are unavailable.
          <a href="/offline" className="ml-1 underline decoration-lime underline-offset-2">
            Details
          </a>
        </div>
      ) : null}

      {updateWaiting ? (
        <div className="pointer-events-auto flex max-w-sm flex-col gap-3 border border-lime/50 bg-navy px-4 py-3 text-chalk shadow-xl">
          <div className="flex items-start gap-2">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
            <p className="text-xs leading-relaxed">
              A VARSITY update is ready. Finish any match or form submission first, then apply it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="lime" onClick={() => void applyUpdate()} disabled={updateBusy}>
              Apply update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-chalk hover:text-lime"
              onClick={() => setUpdateWaiting(null)}
            >
              Later
            </Button>
          </div>
        </div>
      ) : null}

      {installEvent && !installed ? (
        <div className="pointer-events-auto flex items-center gap-3 border border-lime/50 bg-navy px-4 py-3 text-chalk shadow-xl">
          <Download className="size-4 text-lime" aria-hidden />
          <span className="text-xs font-bold">Install VARSITY for quick access</span>
          <Button size="sm" variant="lime" onClick={() => void install()}>
            Install
          </Button>
        </div>
      ) : null}

      {showIosTip && !installed ? (
        <div className="pointer-events-auto flex max-w-sm gap-3 border border-navy/15 bg-chalk px-4 py-3 text-navy shadow-xl">
          <Download className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden />
          <div className="flex-1">
            <p className="text-xs font-bold">Add VARSITY to your Home Screen</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-muted">
              Tap Share in Safari, then &ldquo;Add to Home Screen&rdquo;. iOS does not support a direct install button.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss installation guidance"
            className="size-6 shrink-0 text-ink-muted hover:text-navy"
            onClick={dismissIosTip}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
