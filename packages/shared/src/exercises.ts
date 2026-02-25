import type { SrsStage } from "./srs.js";

export const EXERCISE_TYPES = [
  "flashcard",
  "multiple_choice",
  "multiple_choice_reverse",
  "fill_blank",
  "scramble",
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const EXERCISES_PER_STAGE: Record<SrsStage, ExerciseType[]> = {
  new: ["flashcard", "multiple_choice"],
  stage_1: ["multiple_choice", "multiple_choice_reverse"],
  stage_2: ["multiple_choice", "multiple_choice_reverse", "fill_blank"],
  stage_3: ["scramble", "fill_blank"],
  stage_4: ["scramble", "fill_blank"],
  learned: ["scramble", "fill_blank"],
};

export function getExercisesForStage(stage: SrsStage): ExerciseType[] {
  return EXERCISES_PER_STAGE[stage];
}
