"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark";
        },
      ) => string;
      reset?: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = "varsity-turnstile-script";

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !container.current || !window.turnstile) return;
      window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
        theme: "light",
      });
    }

    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [onToken, siteKey]);

  return (
    <div>
      <div ref={container} data-no-print />
      <p className="mt-1 text-xs text-ink-muted">Security check by Cloudflare Turnstile.</p>
    </div>
  );
}
