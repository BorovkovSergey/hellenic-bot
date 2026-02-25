export const SRS_STAGES = [
  "new",
  "stage_1",
  "stage_2",
  "stage_3",
  "stage_4",
  "learned",
] as const;

export type SrsStage = (typeof SRS_STAGES)[number];

/** Interval in minutes applied when advancing TO a new stage */
const STAGE_INTERVALS: Record<SrsStage, number> = {
  new: 0, // not used directly (can't advance TO 'new')
  stage_1: 0, // new → stage_1
  stage_2: 0, // stage_1 → stage_2
  stage_3: 1440, // stage_2 → stage_3
  stage_4: 1440, // stage_3 → stage_4
  learned: 1440, // stage_4 → learned, or learned → learned
};

export interface ProgressionResult {
  newStage: SrsStage;
  intervalMinutes: number;
}

export function computeProgression(
  currentStage: SrsStage,
  errorCount: number,
): ProgressionResult {
  const idx = SRS_STAGES.indexOf(currentStage);

  if (errorCount === 0) {
    // Advance to next stage
    const nextIdx = Math.min(idx + 1, SRS_STAGES.length - 1);
    const newStage = SRS_STAGES[nextIdx];
    return { newStage, intervalMinutes: STAGE_INTERVALS[newStage] };
  }

  if (errorCount === 1) {
    // Stay at current stage
    return { newStage: currentStage, intervalMinutes: 0 };
  }

  // >1 errors: roll back one stage (min: new)
  const prevIdx = Math.max(idx - 1, 0);
  return { newStage: SRS_STAGES[prevIdx], intervalMinutes: 0 };
}
