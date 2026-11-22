"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { parseQrScanValue } from "@/lib/qr/qr-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const navigatedRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [manual, setManual] = useState("");

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const handleValue = useCallback(
    (value: string) => {
      if (navigatedRef.current) return;
      const target = parseQrScanValue(value, window.location.origin);
      if (!target) {
        setMessage({
          tone: "error",
          text: "That QR code is not a VARSITY PE visitor or room code. Ask the PE office for the current poster.",
        });
        return;
      }
      navigatedRef.current = true;
      setMessage({ tone: "ok", text: "Valid PE code. Opening…" });
      stop();
      router.push(target.destination);
    },
    [router, stop],
  );

  async function start() {
    setMessage(null);
    navigatedRef.current = false;
    if (!videoRef.current || !navigator.mediaDevices?.getUserMedia) {
      setMessage({
        tone: "error",
        text: "Camera access is not available in this browser. Use the manual option below.",
      });
      return;
    }
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) handleValue(result.getText());
        },
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch {
      setMessage({
        tone: "error",
        text: "The camera could not be started. Check browser permissions or enter the code manually.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-navy bg-navy p-3">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full bg-black object-cover"
          muted
          playsInline
          aria-label="QR scanner camera preview"
        />
        {!scanning ? (
          <div className="flex items-center justify-center py-14 text-center text-sm text-chalk/60">
            Camera preview will appear here after you grant access.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {scanning ? (
          <Button variant="destructive" onClick={stop}>
            <CameraOff /> Stop camera
          </Button>
        ) : (
          <Button variant="lime" onClick={start}>
            <Camera /> Start camera
          </Button>
        )}
      </div>

      {message ? (
        <p role="status" className={`border-l-4 p-4 text-sm ${message.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="border-t border-border pt-6">
        <h2 className="text-xl font-bold">Manual entry</h2>
        <p className="mt-1 text-xs text-ink-muted">
          If your camera is unavailable, paste the full PE QR link or its token here.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Label htmlFor="manual-qr">QR link or token</Label>
            <Input
              id="manual-qr"
              className="mt-2"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="https://…/room/…"
            />
          </div>
          <Button
            variant="outline"
            disabled={!manual.trim()}
            onClick={() => {
              const trimmed = manual.trim();
              const withOrigin = trimmed.startsWith("http")
                ? trimmed
                : `${window.location.origin}/room/${encodeURIComponent(trimmed)}`;
              handleValue(withOrigin);
            }}
          >
            <ScanLine /> Open
          </Button>
        </div>
      </div>
    </div>
  );
}
