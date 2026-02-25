import React, { useEffect, useState, useRef, useCallback } from "react";
import type { Exercise, ExerciseResult } from "@hellenic-bot/shared";
import { apiClient } from "../api.js";
import { t, type Lang } from "../i18n.js";
import { showBackButton, showConfirm } from "../telegram.js";
import { FullScreenSpinner } from "../components/FullScreenSpinner.js";
import { ErrorOverlay } from "../components/ErrorOverlay.js";
import { Flashcard } from "../exercises/Flashcard.js";
import { MultipleChoice } from "../exercises/MultipleChoice.js";
import { MultipleChoiceReverse } from "../exercises/MultipleChoiceReverse.js";
import { FillBlank } from "../exercises/FillBlank.js";
import { Scramble } from "../exercises/Scramble.js";

interface LessonProps {
  mode: "new" | "continue" | "review";
  lang: Lang;
  onComplete: (data: any) => void;
  onAbandon: () => void;
}

export function Lesson({ mode, lang, onComplete, onAbandon }: LessonProps) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef<number>(Date.now());
  const i = t(lang);

  const handleAbandon = useCallback(async () => {
    const confirmed = await showConfirm(i.abandonLesson);
    if (confirmed) onAbandon();
  }, [i.abandonLesson, onAbandon]);

  useEffect(() => {
    return showBackButton(handleAbandon);
  }, [handleAbandon]);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const res = await apiClient.learn.lesson.$post({ json: { mode } });
        if (res.ok) {
          const data = await res.json();
          setExercises(data.exercises as Exercise[]);
          timerRef.current = Date.now();
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, [mode]);

  const handleExerciseComplete = async (result: { is_correct: boolean; answer_given: string | null }) => {
    const exercise = exercises![currentIdx];
    const timeSpent = Date.now() - timerRef.current;

    const exerciseResult: ExerciseResult = {
      word_id: exercise.word_id,
      exercise_type: exercise.exercise_type,
      is_correct: result.is_correct,
      answer_given: result.answer_given,
      time_spent_ms: timeSpent,
    };

    const newResults = [...results, exerciseResult];
    setResults(newResults);

    if (currentIdx + 1 < exercises!.length) {
      setCurrentIdx(currentIdx + 1);
      timerRef.current = Date.now();
    } else {
      // Submit results
      setSubmitting(true);
      try {
        const res = await apiClient.learn.complete.$post({
          json: { results: newResults },
        });
        if (res.ok) {
          const data = await res.json();
          onComplete(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return <FullScreenSpinner message={i.preparingLesson} />;
  }

  if (error) {
    return <ErrorOverlay message={i.somethingWrong} buttonText={i.retry} onRetry={onAbandon} />;
  }

  if (submitting) {
    return <FullScreenSpinner />;
  }

  if (!exercises || exercises.length === 0) {
    return <ErrorOverlay message={i.somethingWrong} onRetry={onAbandon} />;
  }

  const exercise = exercises[currentIdx];
  const progress = currentIdx + 1;
  const total = exercises.length;
  const pct = Math.round((currentIdx / total) * 100);

  return (
    <div style={{ minHeight: "100vh", color: "var(--tg-theme-text-color)" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <button onClick={handleAbandon} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--tg-theme-text-color)" }}>
            ✕
          </button>
          <span style={{ fontSize: "14px", opacity: 0.6 }}>
            {progress} / {total}
          </span>
        </div>
        <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(128,128,128,0.2)", borderRadius: "2px" }}>
          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--tg-theme-button-color)", borderRadius: "2px", transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Exercise */}
      {renderExercise(exercise, lang, handleExerciseComplete)}
    </div>
  );
}

function renderExercise(
  exercise: Exercise,
  lang: Lang,
  onComplete: (result: { is_correct: boolean; answer_given: string | null }) => void,
) {
  // Use word_id + exercise_type + current index as key to force remount
  const key = `${exercise.word_id}-${exercise.exercise_type}-${Math.random()}`;

  switch (exercise.exercise_type) {
    case "flashcard":
      return (
        <Flashcard
          key={key}
          prompt={exercise.prompt}
          answer={exercise.answer}
          lang={lang}
          onComplete={onComplete}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoice
          key={key}
          prompt={exercise.prompt}
          options={exercise.options}
          correctIndex={exercise.correct_index}
          onComplete={onComplete}
        />
      );
    case "multiple_choice_reverse":
      return (
        <MultipleChoiceReverse
          key={key}
          prompt={exercise.prompt}
          options={exercise.options}
          correctIndex={exercise.correct_index}
          onComplete={onComplete}
        />
      );
    case "fill_blank":
      return (
        <FillBlank
          key={key}
          prompt={exercise.prompt}
          answer={exercise.answer}
          lang={lang}
          onComplete={onComplete}
        />
      );
    case "scramble":
      return (
        <Scramble
          key={key}
          prompt={exercise.prompt}
          answer={exercise.answer}
          lang={lang}
          onComplete={onComplete}
        />
      );
  }
}
