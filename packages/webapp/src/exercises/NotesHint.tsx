import React, { useState } from "react";

interface NotesHintProps {
  notes: string | null | undefined;
  revealed?: boolean;
}

export function NotesHint({ notes, revealed: revealedProp }: NotesHintProps) {
  const [revealedLocal, setRevealedLocal] = useState(false);
  const revealed = revealedProp || revealedLocal;

  if (!notes) return null;

  return (
    <div
      onClick={() => setRevealedLocal(true)}
      style={{
        fontSize: "14px",
        color: "var(--tg-theme-text-color)",
        opacity: 0.4,
        fontStyle: "italic",
        filter: revealed ? "none" : "blur(4px)",
        cursor: revealed ? "default" : "pointer",
        transition: "filter 0.2s",
        userSelect: revealed ? "auto" : "none",
      }}
    >
      {notes}
    </div>
  );
}
