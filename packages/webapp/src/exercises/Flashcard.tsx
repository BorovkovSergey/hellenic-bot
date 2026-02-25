import React, { useState } from "react";
import { hapticLight } from "../telegram.js";
import { t, type Lang } from "../i18n.js";
import { NotesHint } from "./NotesHint.js";

interface FlashcardProps {
  prompt: { original: string; transcription?: string; notes?: string | null };
  answer: { translation: string };
  lang: Lang;
  onComplete: (result: { is_correct: true; answer_given: null }) => void;
}

export function Flashcard({ prompt, answer, lang, onComplete }: FlashcardProps) {
  const [revealed, setRevealed] = useState(false);
  const i = t(lang);

  const handleReveal = () => {
    hapticLight();
    setRevealed(true);
  };

  const handleContinue = () => {
    hapticLight();
    onComplete({ is_correct: true, answer_given: null });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: "16px" }}>
      <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--tg-theme-text-color)" }}>
        {prompt.original}
      </div>
      {prompt.transcription && (
        <div style={{ fontSize: "16px", color: "var(--tg-theme-text-color)", opacity: 0.5 }}>
          {prompt.transcription}
        </div>
      )}
      <NotesHint notes={prompt.notes} revealed={revealed} />

      {!revealed ? (
        <button onClick={handleReveal} style={actionBtnStyle}>
          {i.tapToReveal}
        </button>
      ) : (
        <>
          <div style={{ fontSize: "20px", color: "var(--tg-theme-text-color)", marginTop: "16px" }}>
            {answer.translation}
          </div>
          <button onClick={handleContinue} style={actionBtnStyle}>
            {i.continueBtn} →
          </button>
        </>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "14px 32px",
  backgroundColor: "var(--tg-theme-button-color)",
  color: "var(--tg-theme-button-text-color)",
  border: "none",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer",
};
