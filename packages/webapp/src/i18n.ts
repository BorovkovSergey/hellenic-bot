const translations = {
  en: {
    appTitle: "Hellenic",
    learnNew: "Learn New",
    continue: "Continue",
    review: "Review",
    wordsLearned: "words learned",
    allCaughtUp: "All caught up! Come back later.",
    settings: "Settings",
    wordsPerLesson: "Words per lesson",
    language: "Language",
    failedToSave: "Failed to save. Try again.",
    preparingLesson: "Preparing lesson...",
    lessonComplete: "Lesson Complete",
    correct: "correct",
    backToHome: "Back to Home",
    tapToReveal: "Tap to reveal",
    continueBtn: "Continue",
    check: "Check",
    abandonLesson: "Abandon lesson? Progress will be lost.",
    noConnection: "No connection. Check your internet and try again.",
    somethingWrong: "Something went wrong. Try again.",
    sessionExpired: "Session expired. Please reopen the app.",
    retry: "Retry",
    stageNew: "New",
    stageStage1: "Stage 1",
    stageStage2: "Stage 2",
    stageStage3: "Stage 3",
    stageStage4: "Stage 4",
    stageLearned: "Learned",
  },
  ru: {
    appTitle: "Hellenic",
    learnNew: "Новые слова",
    continue: "Продолжить",
    review: "Повторение",
    wordsLearned: "слов выучено",
    allCaughtUp: "Всё на сегодня! Возвращайся позже.",
    settings: "Настройки",
    wordsPerLesson: "Слов за урок",
    language: "Язык",
    failedToSave: "Не удалось сохранить. Попробуй ещё раз.",
    preparingLesson: "Подготовка урока...",
    lessonComplete: "Урок завершён",
    correct: "правильно",
    backToHome: "На главную",
    tapToReveal: "Нажми, чтобы открыть",
    continueBtn: "Далее",
    check: "Проверить",
    abandonLesson: "Прервать урок? Прогресс будет потерян.",
    noConnection: "Нет соединения. Проверь интернет и попробуй снова.",
    somethingWrong: "Что-то пошло не так. Попробуй ещё раз.",
    sessionExpired: "Сессия истекла. Пожалуйста, откройте приложение заново.",
    retry: "Повторить",
    stageNew: "Новое",
    stageStage1: "Этап 1",
    stageStage2: "Этап 2",
    stageStage3: "Этап 3",
    stageStage4: "Этап 4",
    stageLearned: "Выучено",
  },
} as const;

export type Translations = typeof translations.en;
export type Lang = keyof typeof translations;

export function t(lang: Lang): Translations {
  return translations[lang] ?? translations.en;
}

export function stageName(stage: string, lang: Lang): string {
  const map: Record<string, keyof Translations> = {
    new: "stageNew",
    stage_1: "stageStage1",
    stage_2: "stageStage2",
    stage_3: "stageStage3",
    stage_4: "stageStage4",
    learned: "stageLearned",
  };
  const key = map[stage];
  if (!key) return stage;
  return t(lang)[key];
}
