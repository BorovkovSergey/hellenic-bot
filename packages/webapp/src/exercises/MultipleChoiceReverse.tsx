import React, { useState, useEffect, useMemo } from "react";
import { hapticSuccess, hapticError } from "../telegram.js";

interface Option {
  original: string;
  transcription?: string;
}

interface MultipleChoiceReverseProps {
  prompt: { translation: string };
  options: Option[];
  correctIndex: number;
  onComplete: (result: { is_correct: boolean; answer_given: string }) => void;
}

export function MultipleChoiceReverse({ prompt, options, correctIndex, onComplete }: MultipleChoiceReverseProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const shuffled = useMemo(() => {
    const indices = options.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [options]);

  const correctShuffledIdx = shuffled.indexOf(correctIndex);

  useEffect(() => {
    if (selected !== null) {
      const timer = setTimeout(() => {
        const isCorrect = selected === correctShuffledIdx;
        onComplete({ is_correct: isCorrect, answer_given: options[shuffled[selected]].original });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === correctShuffledIdx) {
      hapticSuccess();
    } else {
      hapticError();
    }
  };

  return (
    <div style={{ padding: "32px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "24px", color: "var(--tg-theme-text-color)" }}>
          {prompt.translation}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {shuffled.map((origIdx, displayIdx) => {
          let bg = "rgba(128,128,128,0.1)";
          if (selected !== null) {
            if (displayIdx === correctShuffledIdx) bg = "rgba(76,175,80,0.3)";
            else if (displayIdx === selected) bg = "rgba(244,67,54,0.3)";
          }
          const opt = options[origIdx];

          return (
            <button
              key={displayIdx}
              onClick={() => handleSelect(displayIdx)}
              disabled={selected !== null}
              style={{
                padding: "14px 16px",
                border: "none",
                borderRadius: "10px",
                backgroundColor: bg,
                color: "var(--tg-theme-text-color)",
                fontSize: "16px",
                textAlign: "left",
                cursor: selected !== null ? "default" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{opt.original}</div>
              {opt.transcription && (
                <div style={{ fontSize: "13px", opacity: 0.5, marginTop: "2px" }}>{opt.transcription}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
