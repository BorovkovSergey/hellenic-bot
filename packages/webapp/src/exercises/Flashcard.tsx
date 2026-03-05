import React, { useState, useEffect } from "react";
import { hapticLight } from "../telegram.js";
import { t, type Lang } from "../i18n.js";
import { NotesHint } from "./NotesHint.js";
import { speakWord } from "../speak.js";
import { SpeakButton } from "../components/SpeakButton.js";

interface FlashcardProps {
  prompt: { original: string; transcription?: string; notes?: string | null };
  answer: { translation: string };
  lang: Lang;
  onComplete: (result: { is_correct: true; answer_given: null }) => void;
}

export function Flashcard({ prompt, answer, lang, onComplete }: FlashcardProps) {
  const [revealed, setRevealed] = useState(false);
  const i = t(lang);

  useEffect(() => {
    speakWord(prompt.original);
  }, []);

  const handleReveal = () => {
    hapticLight();
    setRevealed(true);
  };

  const handleContinue = () => {
    hapticLight();
    onComplete({ is_correct: true, answer_given: null });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "32px 24px" }}>
      {/* Top zone: prompt */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
          <span style={{ fontSize: "32px", fontWeight: "bold", color: "var(--tg-theme-text-color)" }}>
            {prompt.original}
          </span>
          <SpeakButton text={prompt.original} />
        </div>
        {prompt.transcription && (
          <div style={{ fontSize: "16px", color: "var(--tg-theme-text-color)", opacity: 0.5, marginTop: "8px" }}>
            {prompt.transcription}
          </div>
        )}
        <NotesHint notes={prompt.notes} revealed={revealed} />
        {revealed && (
          <div style={{ fontSize: "20px", color: "var(--tg-theme-text-color)", marginTop: "16px" }}>
            {answer.translation}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom zone: action */}
      <div style={{ textAlign: "center", paddingBottom: "24px" }}>
        {!revealed ? (
          <button onClick={handleReveal} style={actionBtnStyle}>
            {i.tapToReveal}
          </button>
        ) : (
          <button onClick={handleContinue} style={actionBtnStyle}>
            {i.continueBtn} →
          </button>
        )}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "14px 32px",
  backgroundColor: "var(--tg-theme-button-color)",
  color: "var(--tg-theme-button-text-color)",
  border: "none",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer",
};
