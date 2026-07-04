"use client";

import { useEffect } from "react";

// There was no error boundary anywhere in the app before this - a
// root-level one is the last line of defense for anything that throws
// outside a route segment's own error.tsx (e.g. in the root layout
// itself). Kept deliberately minimal/inline-styled since this replaces
// the entire <html> document when it renders, so it can't rely on the
// app's normal globals.css/layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#04091a",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Something went wrong</h1>
        <p style={{ fontSize: "0.875rem", color: "#9ca3af", maxWidth: 360 }}>
          Please try again. If this keeps happening, your data is safe - reload the app or come back later.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.875rem",
            padding: "0.625rem 1.5rem",
            borderRadius: "0.75rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
