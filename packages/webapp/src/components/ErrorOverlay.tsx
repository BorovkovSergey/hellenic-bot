import React from "react";

interface ErrorOverlayProps {
  message: string;
  buttonText?: string;
  onRetry?: () => void;
}

export function ErrorOverlay({ message, buttonText, onRetry }: ErrorOverlayProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      padding: "24px",
      textAlign: "center",
      color: "var(--tg-theme-text-color)",
    }}>
      <p style={{ fontSize: "16px", marginBottom: "16px" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "12px 24px",
            backgroundColor: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {buttonText ?? "Retry"}
        </button>
      )}
    </div>
  );
}
