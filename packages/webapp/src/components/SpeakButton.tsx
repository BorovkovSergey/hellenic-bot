import React from "react";
import { speakWord } from "../speak.js";
import { hapticLight } from "../telegram.js";

interface SpeakButtonProps {
  text: string;
}

export function SpeakButton({ text }: SpeakButtonProps) {
  const handleTap = () => {
    hapticLight();
    speakWord(text);
  };

  return (
    <button
      onClick={handleTap}
      aria-label="Pronounce"
      style={{
        width: "32px",
        height: "32px",
        padding: 0,
        border: "none",
        background: "none",
        color: "var(--tg-theme-hint-color)",
        fontSize: "20px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      🔊
    </button>
  );
}
