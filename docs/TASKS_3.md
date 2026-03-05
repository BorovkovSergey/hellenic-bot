# Hellenic Bot — Tasks: Audio Pronunciation & Sticky Bottom Layout

Two UI improvements: text-to-speech pronunciation for Greek words, and sticky-bottom layout for action buttons. Both are webapp-only, no backend changes.

## Dependency Graph

```
Audio:
1 SpeakWord utility
└── 2 SpeakButton component
    ├── 3 Flashcard: auto-play + replay button
    ├── 4 MultipleChoice: auto-play + replay button
    ├── 5 MultipleChoiceReverse: auto-play on correct answer reveal
    ├── 6 FillBlank: auto-play on correct answer
    └── 7 Scramble: auto-play on correct answer

Layout (independent of audio):
8 Home: sticky bottom buttons
9 Lesson exercises: sticky bottom actions
  ├── 9a Flashcard
  ├── 9b MultipleChoice
  ├── 9c MultipleChoiceReverse
  ├── 9d FillBlank
  └── 9e Scramble
```

---

## Task 1: `speakWord` utility

**Depends on:** —

**Goal:** Create a thin wrapper around `speechSynthesis.speak()` for Greek pronunciation.

**Create:** `packages/webapp/src/speak.ts`

```typescript
export function speakWord(text: string): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // stop any in-progress utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "el-GR";
  utterance.rate = 0.9; // slightly slower for learners
  window.speechSynthesis.speak(utterance);
}
```

Behavior:
- If `speechSynthesis` is not supported, silently no-op
- Calling `speakWord` while another utterance is playing cancels the previous one (prevents overlap)
- Language is always `el-GR` (Greek)
- Rate 0.9 for slightly slower, clearer pronunciation

---

## Task 2: `SpeakButton` component

**Depends on:** Task 1

**Goal:** A small icon button that plays pronunciation on tap.

**Create:** `packages/webapp/src/components/SpeakButton.tsx`

```typescript
interface SpeakButtonProps {
  text: string;
}
```

Visual:
- A small round/icon button with a speaker/volume icon (use unicode `🔊` or inline SVG)
- Positioned inline next to the Greek word
- Styled to match Telegram theme: `var(--tg-theme-hint-color)` or slightly muted
- On tap: calls `speakWord(text)` + `hapticLight()`

Size: ~32x32px, no background, icon only. Should not compete with the word visually — it's a secondary action.

---

## Task 3: Flashcard — auto-play + replay button

**Depends on:** Task 1, Task 2

**Goal:** Pronounce the Greek word automatically when the exercise mounts, and provide a replay button.

**Modify:** `packages/webapp/src/exercises/Flashcard.tsx`

Changes:
1. **Auto-play on mount:** call `speakWord(prompt.original)` in a `useEffect` on mount
2. **Replay button:** render `<SpeakButton text={prompt.original} />` next to the Greek word (same line or just below)

```
┌──────────────────────┐
│                      │
│    αγάπη  🔊         │  ← word + speak button
│    agápi             │
│                      │
│  [ Tap to reveal ]   │
└──────────────────────┘
```

The button remains available in both states (before and after reveal) so the user can replay anytime.

---

## Task 4: MultipleChoice — auto-play + replay button

**Depends on:** Task 1, Task 2

**Goal:** Same as Flashcard — auto-play the Greek prompt word on mount + replay button.

**Modify:** `packages/webapp/src/exercises/MultipleChoice.tsx`

Changes:
1. **Auto-play on mount:** call `speakWord(prompt.original)` in a `useEffect` on mount
2. **Replay button:** render `<SpeakButton text={prompt.original} />` next to the Greek word

```
┌──────────────────────────────┐
│                              │
│     ευχαριστώ  🔊            │  ← word + speak button
│     efcharistó               │
│                              │
│  [ option 1 ]                │
│  [ option 2 ]                │
│  [ option 3 ]                │
│  [ option 4 ]                │
└──────────────────────────────┘
```

The button remains available after answering.

---

## Task 5: MultipleChoiceReverse — auto-play on correct answer reveal

**Depends on:** Task 1

**Goal:** After the user selects an answer (correct or incorrect), pronounce the correct Greek word.

**Modify:** `packages/webapp/src/exercises/MultipleChoiceReverse.tsx`

Changes:
1. When `selected !== null` (user answered), call `speakWord(options[correctIndex].original)` once
2. No replay button — the word is among option buttons, no natural place for a persistent speaker icon

Implementation: use a `useEffect` that triggers when `selected` transitions from `null` to a value:
```typescript
useEffect(() => {
  if (selected !== null) {
    speakWord(options[correctIndex].original);
  }
}, [selected]);
```

---

## Task 6: FillBlank — auto-play on correct answer

**Depends on:** Task 1

**Goal:** After the user submits a correct answer, pronounce the Greek word.

**Modify:** `packages/webapp/src/exercises/FillBlank.tsx`

Changes:
1. When `result === "correct"`, call `speakWord(answer.original)` once
2. No replay button — the input area transitions to a result state, no natural place

Implementation: use a `useEffect` that triggers when `result` changes:
```typescript
useEffect(() => {
  if (result === "correct") {
    speakWord(answer.original);
  }
}, [result]);
```

---

## Task 7: Scramble — auto-play on correct answer

**Depends on:** Task 1

**Goal:** After the user submits a correct answer, pronounce the Greek word.

**Modify:** `packages/webapp/src/exercises/Scramble.tsx`

Changes:
1. When `result === "correct"`, call `speakWord(answer.original)` once
2. No replay button — same reasoning as FillBlank

Implementation: use a `useEffect` that triggers when `result` changes:
```typescript
useEffect(() => {
  if (result === "correct") {
    speakWord(answer.original);
  }
}, [result]);
```

---

## Task 8: Home screen — sticky bottom buttons

**Depends on:** —

**Goal:** Pin the lesson mode buttons (Learn New, Continue, Review) to the bottom of the viewport. Progress indicator stays at the top.

**Modify:** `packages/webapp/src/screens/Home.tsx`

Layout approach:
- The screen uses `display: flex; flex-direction: column; min-height: 100vh`
- Top section: header + progress bar (natural flow)
- Flexible spacer: `flex: 1` fills remaining space
- Bottom section: the three mode buttons, pinned to bottom

No position sticky or fixed — flexbox with `min-height: 100vh` achieves the same result without scroll issues.

---

## Task 9: Lesson exercises — sticky bottom actions

**Depends on:** —

**Goal:** In each exercise component, pin action buttons/options/input to the bottom of the available area. The prompt (word, transcription, notes) stays at the top.

**Modify:** all five exercise components + Lesson screen container

The Lesson screen already wraps exercises in a `min-height: 100vh` container with a header (close button + progress bar). Each exercise component should use flexbox to push its action area to the bottom of the remaining space.

Layout pattern (same for all exercises):
```tsx
<div style={{
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
}}>
  {/* Top zone: prompt content */}
  <div>...</div>

  {/* Flexible spacer */}
  <div style={{ flex: 1 }} />

  {/* Bottom zone: action buttons / options / input */}
  <div>...</div>
</div>
```

The Lesson screen container must also become a flex column with `min-height: 100vh` so that child exercises can use `flex: 1` to fill remaining height.

**Modify:** `packages/webapp/src/screens/Lesson.tsx`

```tsx
<div style={{
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
}}>
  {/* Header: close + progress bar */}
  <div>...</div>

  {/* Exercise fills remaining space */}
  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
    {renderExercise(...)}
  </div>
</div>
```

### 9a. Flashcard

**Modify:** `packages/webapp/src/exercises/Flashcard.tsx`

- Top zone: Greek word + 🔊 button, transcription, notes
- Bottom zone: "Tap to reveal" button (state 1) / translation + "Continue" button (state 2)

### 9b. MultipleChoice

**Modify:** `packages/webapp/src/exercises/MultipleChoice.tsx`

- Top zone: Greek word + 🔊 button, transcription, notes
- Bottom zone: 4 option buttons

### 9c. MultipleChoiceReverse

**Modify:** `packages/webapp/src/exercises/MultipleChoiceReverse.tsx`

- Top zone: translation, notes
- Bottom zone: 4 option buttons (Greek words with transcription)

### 9d. FillBlank

**Modify:** `packages/webapp/src/exercises/FillBlank.tsx`

- Top zone: translation, notes
- Bottom zone: text input + "Check" button (+ correct answer display on incorrect)

### 9e. Scramble

**Modify:** `packages/webapp/src/exercises/Scramble.tsx`

- Top zone: translation, notes
- Bottom zone: letter slots + available letters + "Check" button (+ correct answer on incorrect)
