import React, { useState, useEffect } from "react";
import { hapticSuccess, hapticError } from "../telegram.js";
import { t, type Lang } from "../i18n.js";

interface FillBlankProps {
  prompt: { translation: string };
  answer: { original: string };
  lang: Lang;
  onComplete: (result: { is_correct: boolean; answer_given: string }) => void;
}

export function FillBlank({ prompt, answer, lang, onComplete }: FillBlankProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const i = t(lang);

  useEffect(() => {
    if (result !== null) {
      const timer = setTimeout(() => {
        onComplete({
          is_correct: result === "correct",
          answer_given: input,
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleCheck = () => {
    const normalized = input.trim().toLowerCase();
    const expected = answer.original.trim().toLowerCase();
    if (normalized === expected) {
      setResult("correct");
      hapticSuccess();
    } else {
      setResult("incorrect");
      hapticError();
    }
  };

  return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
      <div style={{ fontSize: "24px", color: "var(--tg-theme-text-color)" }}>
        {prompt.translation}
      </div>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !result && handleCheck()}
        disabled={result !== null}
        autoFocus
        lang="el"
        style={{
          width: "100%",
          maxWidth: "300px",
          padding: "14px 16px",
          border: result === "correct"
            ? "2px solid #4caf50"
            : result === "incorrect"
              ? "2px solid #f44336"
              : "1px solid rgba(128,128,128,0.3)",
          borderRadius: "10px",
          fontSize: "20px",
          textAlign: "center",
          backgroundColor: "transparent",
          color: "var(--tg-theme-text-color)",
          outline: "none",
        }}
      />

      {result === "incorrect" && (
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--tg-theme-text-color)" }}>
            {answer.original}
          </div>
        </div>
      )}

      {result === null && (
        <button
          onClick={handleCheck}
          disabled={input.trim() === ""}
          style={{
            marginTop: "16px",
            padding: "14px 32px",
            backgroundColor: input.trim() ? "var(--tg-theme-button-color)" : "rgba(128,128,128,0.2)",
            color: input.trim() ? "var(--tg-theme-button-text-color)" : "rgba(128,128,128,0.5)",
            border: "none",
            borderRadius: "12px",
            fontSize: "16px",
            cursor: input.trim() ? "pointer" : "default",
          }}
        >
          {i.check}
        </button>
      )}
    </div>
  );
}
