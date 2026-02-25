import React from "react";

export function FullScreenSpinner({ message }: { message?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      gap: "16px",
      color: "var(--tg-theme-text-color)",
    }}>
      <div className="spinner" />
      {message && <p style={{ fontSize: "14px", opacity: 0.7 }}>{message}</p>}
    </div>
  );
}
