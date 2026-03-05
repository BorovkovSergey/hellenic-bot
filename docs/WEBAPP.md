# Hellenic Bot — Mini App UX

The Telegram Mini App where all learning happens. Built with React + Vite, opened from the bot's inline button.

## Screen Flow

```
┌──────────┐     ┌──────────┐
│          │────>│          │
│   Home   │     │ Settings │
│          │<────│          │
└────┬─────┘     └──────────┘
     │
     │ Start lesson
     ▼
┌──────────┐
│          │
│  Lesson  │
│          │
└────┬─────┘
     │
     │ All exercises done
     ▼
┌──────────┐
│ Lesson   │
│ Complete │──── Back to Home
└──────────┘
```

## Screens

### 1. Home

The landing screen after authentication. Shows progress summary and available learning modes.

```
┌─────────────────────────────┐
│ 🇬🇷 Hellenic          ⚙️     │  ← Settings gear
├─────────────────────────────┤
│                             │
│   42 / 100 words learned    │  ← Progress indicator
│   ████████░░░░░  42%        │  ← Progress bar
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│                             │
│  ┌─────────────────────┐    │
│  │  📗 Learn New  (15) │    │  ← Available count
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  📙 Continue    (5) │    │  ← Due in-progress words
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  📘 Review      (3) │    │  ← Due learned words
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

- Numbers in parentheses come from `GET /learn/stats`
- A mode button is disabled when its count is 0
- If all counts are 0 — show "All caught up! Come back later."
- Settings gear opens the Settings screen

### 2. Settings

Two settings, both persisted to DB via `PATCH /users/me/settings`.

```
┌─────────────────────────────┐
│ ← Settings                  │  ← Telegram back button
├─────────────────────────────┤
│                             │
│  Words per lesson           │
│  ◀  5  ▶                    │  ← Stepper, range 1–20
│                             │
│  Language                   │
│  [ EN ] [ RU ]              │  ← Toggle, selected = filled
│                             │
└─────────────────────────────┘
```

- Changes are saved immediately on interaction (no save button)
- If `PATCH /users/me/settings` fails — revert the control to the previous value and show a toast with "Failed to save. Try again."
- Language toggle switches both UI text and word translations. All user-facing strings must have `en` and `ru` variants
- Back button returns to Home (triggers a stats refetch so the Home screen reflects updated `words_per_lesson` and `display_language`)

### 3. Lesson

The exercise screen. Shows one exercise at a time with a progress indicator.

```
┌─────────────────────────────┐
│ ✕                  3 / 12   │  ← Close + progress
│ ████████░░░░░░░░░░░░░░░░░░  │  ← Progress bar
├─────────────────────────────┤
│                             │
│   [ Prompt: word / hint ]   │  ← Top zone (content)
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│     [ Action area ]         │  ← Buttons / options / input
└─────────────────────────────┘
```

- Close button (✕) asks for confirmation before abandoning the lesson; if confirmed, navigates to Home. All accumulated results are lost — nothing is sent to the server (see LESSON.md — Edge Cases)
- Progress bar fills as exercises are completed
- After answering, brief feedback is shown (correct/incorrect) before auto-advancing

### 4. Lesson Complete

Summary shown after completing all exercises.

```
┌─────────────────────────────┐
│                             │
│        Lesson Complete      │
│                             │
│    4 / 7 correct (57%)      │
│                             │
├─────────────────────────────┤
│  γεια         new → stage_1 │  ← Advanced
│  ευχαριστώ    stage_1 → new │  ← Rolled back
│  νερό         stage_2 ●     │  ← Stayed
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │     Back to Home    │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

- Each word shows its stage transition with visual indicators
- `previous_stage: null` from the API (first encounter) is displayed as `"new"` — e.g. `new → stage_1`
- "Back to Home" returns to the Home screen with refreshed stats

## Audio Pronunciation

Greek words are pronounced using the browser's **Web Speech Synthesis API** (`speechSynthesis`). No backend or audio files required.

**Technology:** `SpeechSynthesisUtterance` with `lang: "el-GR"`, `rate: 0.9` (slightly slower for learners).

**When audio plays:**

| Exercise              | Auto-play trigger                     | Replay button |
|-----------------------|---------------------------------------|---------------|
| Flashcard             | On mount (word appears)               | Yes           |
| Multiple Choice       | On mount (word appears)               | Yes           |
| Multiple Choice Rev.  | On answer reveal (correct word)       | No            |
| Fill Blank            | On correct answer                     | No            |
| Scramble              | On correct answer                     | No            |

**Replay button:** A small speaker icon (`SpeakButton`) displayed inline next to the Greek word. Only present in exercises where the Greek word is the prompt (Flashcard, Multiple Choice). Tapping it replays the pronunciation.

**Fallback:** If `speechSynthesis` is not available in the browser, all audio features silently no-op. No error shown.

---

## Exercise Types — UI

**Layout rule:** every exercise uses a two-zone layout within the full viewport height. The **top zone** (prompt: word, transcription, notes) is positioned near the top. The **bottom zone** (action buttons, options, input) is pinned to the bottom of the viewport. A flexible spacer fills the gap between zones. This keeps action targets in a consistent, thumb-friendly position regardless of content height.

**Typography rule:** wherever a Greek word appears, show it as **bold/large** (primary focus) with transcription below in **muted/small** (secondary). The user should focus on the Greek script, transcription is a reading aid.

**Notes display rule:** if a word has `notes` (grammar hint), it is rendered as **muted italic small text** near the prompt, **blurred by default**. The user taps the blurred text to reveal it. This prevents accidental spoilers (e.g. an article that gives away the word's gender). Placement depends on exercise type (see mockups below). Notes are `null` for words without grammar hints — nothing is rendered in that case.

**Notes blur behavior:**
- Default state: text is rendered but blurred (`filter: blur(4px)`), not readable
- Revealed automatically when the user answers (selects an option, checks fill_blank/scramble, or reveals a flashcard)
- Can also be revealed manually by tapping the blurred text
- Once revealed, stays revealed for the rest of that exercise (no re-blur)
- Each new exercise resets the blur state (blurred again)

### Flashcard

The user sees the Greek word, tries to recall the translation, then reveals it.

```
State 1 (front):                State 2 (revealed):
┌────────────────────┐          ┌────────────────────┐
│                    │          │                    │
│    αγάπη  🔊       │  ← bold  │    αγάπη  🔊       │
│       agápi        │  ← muted │       agápi        │
│       ░░░          │  ← notes │         η          │
│                    │  blurred │                    │
│                    │          │       love         │
│         ·          │  flex    │                    │
│                    │  space   │         ·          │
├────────────────────┤  bottom  ├────────────────────┤
│ [ Tap to reveal ]  │          │  [ Continue → ]    │
└────────────────────┘          └────────────────────┘
```

- Tap the card or button to reveal the translation
- After reveal, tap "Continue" to proceed — always counts as correct
- Notes (if present) are shown below transcription — blurred by default, tap to reveal
- Audio: auto-plays on mount + 🔊 replay button next to the word

### Multiple Choice

Show Greek word, pick the correct translation from 4 options. The API always returns the correct answer at `correct_index: 0` — the client must shuffle options for display and track the real correct position after shuffle.

```
┌─────────────────────────────┐
│                             │
│     ευχαριστώ  🔊           │  ← bold, large
│        efcharistó           │  ← muted, small
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│  ┌───────────────────────┐  │
│  │     thank you         │  │  ← Correct
│  ├───────────────────────┤  │
│  │     goodbye           │  │
│  ├───────────────────────┤  │
│  │     please            │  │
│  ├───────────────────────┤  │
│  │     sorry             │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- On tap: correct answer highlights green, wrong answer highlights red (correct also shown)
- Auto-advance after brief delay
- Notes (if present) shown below transcription — blurred by default, tap to reveal
- Audio: auto-plays on mount + 🔊 replay button next to the word

### Multiple Choice Reverse

Show translation, pick the correct Greek word from 4 options. Same client-side shuffle as Multiple Choice.

```
┌─────────────────────────────┐
│                             │
│          thank you          │
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│  ┌───────────────────────┐  │
│  │  ευχαριστώ            │  │  ← Correct
│  │  efcharistó           │  │
│  ├───────────────────────┤  │
│  │  αντίο                │  │
│  │  adío                 │  │
│  ├───────────────────────┤  │
│  │  παρακαλώ             │  │
│  │  parakaló             │  │
│  ├───────────────────────┤  │
│  │  συγνώμη              │  │
│  │  signómi              │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

Same interaction as multiple choice, but reversed direction.
- Notes (if present) shown below translation — blurred by default, tap to reveal
- Audio: pronounces the correct Greek word when the answer is revealed

### Fill Blank

Type the Greek word given its translation.

```
┌─────────────────────────────┐
│                             │
│          water              │  ← translation
│           ░░                │  ← notes (blurred)
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│    ┌─────────────────┐      │
│    │ ν ε ρ _         │      │  ← Text input
│    └─────────────────┘      │
│                             │
│       [ Check ]             │
└─────────────────────────────┘
```

- Greek keyboard input
- On submit: compare answer (case-insensitive, trimmed, accents must match exactly)
- Show correct answer if wrong: word bold + transcription muted below it
- Notes (if present) shown below translation — blurred by default, tap to reveal
- Audio: pronounces the word on correct answer

### Scramble

Arrange shuffled letters of the Greek word in the correct order.

```
┌─────────────────────────────┐
│                             │
│          water              │  ← translation
│           ░░                │  ← notes (blurred)
│                             │
│              ·              │  ← flexible space
│                             │
├─────────────────────────────┤  ← pinned to bottom
│    Answer: [ ν ][ ε ][ _ ]  │  ← Slots
│                             │
│    [ ό ][ ν ][ ρ ][ ε ]     │  ← Available letters
│                             │
│       [ Check ]             │
└─────────────────────────────┘
```

- Tap a letter to place it in the next empty slot
- Tap a placed letter to remove it
- Check button validates the full word
- **Multi-word phrases:** each word is a separate group of slots and available letters, with a fixed space separator between groups. The user fills each group independently
- Notes (if present) shown below translation — blurred by default, tap to reveal
- Audio: pronounces the word on correct answer

## Authentication

On open, the Mini App authenticates via Telegram `initData`:

```
App opens
  │
  ├── Read Telegram.WebApp.initData
  ├── POST /auth/validate { init_data: ... }
  │     ├── Server validates signature
  │     ├── Upserts user
  │     └── Returns JWT + user profile
  │
  ├── Store JWT in memory (not localStorage — session-scoped)
  └── Attach to all subsequent requests: Authorization: Bearer <token>
```

- JWT has 24h TTL. If a request returns `401`, redirect the user to reopen the Mini App (Telegram will provide fresh `initData`)
- No refresh token mechanism — the Mini App session is short-lived

---

## Loading & Error States

### Loading

- **App startup** (auth in progress): full-screen spinner
- **Home screen** (fetching stats): skeleton placeholders for progress bar and mode buttons
- **Starting lesson** (fetching exercises): full-screen spinner with "Preparing lesson..."
- **Submitting results** (POST /learn/complete): button shows spinner, disable interaction

### Errors

- **Network error** (no connection): overlay with "No connection. Check your internet and try again." + retry button
- **API error** (500): overlay with "Something went wrong. Try again." + retry button
- **Expired token** (401 on any request): overlay with "Session expired. Please reopen the app." (user must close and reopen the Mini App for fresh `initData`)
- **No words for mode** (400 from POST /learn/lesson): should not happen if buttons are disabled correctly; if it does, show a toast and return to Home

---

## Telegram Mini App Integration

### Theme

Use Telegram theme colors via CSS variables:
- `var(--tg-theme-bg-color)` — background
- `var(--tg-theme-text-color)` — text
- `var(--tg-theme-button-color)` — primary buttons
- `var(--tg-theme-button-text-color)` — button text

No custom color palette — inherit everything from Telegram.

### Back Button

Use `Telegram.WebApp.BackButton`:
- Show on Settings, Lesson, and Lesson Complete screens
- On Home screen — hide (it's the root)
- On Lesson — back button triggers "abandon lesson" confirmation; if confirmed, navigates to Home (same behavior as the in-app ✕ close button)
- On Lesson Complete — navigates to Home (same as "Back to Home" button)

### Haptic Feedback

Use `Telegram.WebApp.HapticFeedback`:
- `impactOccurred('light')` — on button tap
- `notificationOccurred('success')` — correct answer
- `notificationOccurred('error')` — wrong answer

### Viewport

Use `Telegram.WebApp.expand()` on load to use full screen height.
