"use client";

/** Root-level boundary for failures in the root layout itself. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            background: "#F4F2E9",
            color: "#101D2C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Manrope, Segoe UI, sans-serif",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <p style={{ color: "#F27A5C", fontWeight: 800, letterSpacing: 2 }}>VARSITY</p>
            <h1 style={{ fontSize: 32, margin: "12px 0" }}>VARSITY could not start</h1>
            <p style={{ color: "#4B5563", lineHeight: 1.6 }}>
              Please check your connection and try again. Reference: {error.digest ?? "app-error"}
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 24,
                background: "#101D2C",
                color: "#C8F169",
                border: 0,
                padding: "12px 24px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
