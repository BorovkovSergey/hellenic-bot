import React, { useEffect, useCallback } from "react";
import { SRS_STAGES } from "@hellenic-bot/shared";
import { t, stageName, type Lang } from "../i18n.js";
import { showBackButton, hapticLight } from "../telegram.js";

interface WordResult {
  word_id: number;
  original: string;
  errors: number;
  previous_stage: string | null;
  new_stage: string;
}

interface Summary {
  total_exercises: number;
  correct: number;
  incorrect: number;
  words_advanced: number;
  words_stayed: number;
  words_rolled_back: number;
}

interface LessonCompleteProps {
  data: { words: WordResult[]; summary: Summary };
  lang: Lang;
  onBack: () => void;
}

function stageIndex(stage: string): number {
  return SRS_STAGES.indexOf(stage as any);
}

export function LessonComplete({ data, lang, onBack }: LessonCompleteProps) {
  const i = t(lang);

  const handleBack = useCallback(() => {
    hapticLight();
    onBack();
  }, [onBack]);

  useEffect(() => {
    return showBackButton(handleBack);
  }, [handleBack]);

  const { summary, words } = data;
  const pct = summary.total_exercises > 0
    ? Math.round((summary.correct / summary.total_exercises) * 100)
    : 0;

  return (
    <div style={{ padding: "32px 24px", color: "var(--tg-theme-text-color)" }}>
      <h1 style={{ textAlign: "center", fontSize: "24px", marginBottom: "8px" }}>
        {i.lessonComplete}
      </h1>
      <p style={{ textAlign: "center", fontSize: "18px", opacity: 0.8, marginBottom: "32px" }}>
        {summary.correct} / {summary.total_exercises} {i.correct} ({pct}%)
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
        {words.map((w) => {
          const prevStage = w.previous_stage ?? "new";
          const prevIdx = stageIndex(prevStage);
          const newIdx = stageIndex(w.new_stage);

          let color = "var(--tg-theme-text-color)";
          let indicator: string;

          if (newIdx > prevIdx) {
            color = "#4caf50";
            indicator = `${stageName(prevStage, lang)} → ${stageName(w.new_stage, lang)}`;
          } else if (newIdx < prevIdx) {
            color = "#f44336";
            indicator = `${stageName(prevStage, lang)} → ${stageName(w.new_stage, lang)}`;
          } else {
            indicator = `${stageName(w.new_stage, lang)} ●`;
          }

          return (
            <div
              key={w.word_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                backgroundColor: "rgba(128,128,128,0.05)",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: "16px" }}>{w.original}</span>
              <span style={{ fontSize: "13px", color }}>{indicator}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleBack}
        style={{
          width: "100%",
          padding: "14px",
          backgroundColor: "var(--tg-theme-button-color)",
          color: "var(--tg-theme-button-text-color)",
          border: "none",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        {i.backToHome}
      </button>
    </div>
  );
}
