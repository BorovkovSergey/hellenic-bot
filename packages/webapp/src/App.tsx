import React, { useState, useEffect, useCallback } from "react";
import type { User } from "@hellenic-bot/shared";
import { apiClient, setToken } from "./api.js";
import { tg, expandApp } from "./telegram.js";
import { type Lang } from "./i18n.js";
import { FullScreenSpinner } from "./components/FullScreenSpinner.js";
import { ErrorOverlay } from "./components/ErrorOverlay.js";
import { Home } from "./screens/Home.js";
import { Settings } from "./screens/Settings.js";
import { Lesson } from "./screens/Lesson.js";
import { LessonComplete } from "./screens/LessonComplete.js";

type Screen =
  | { name: "home" }
  | { name: "settings" }
  | { name: "lesson"; mode: "new" | "continue" | "review" }
  | { name: "lesson_complete"; data: any };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [wordsPerLesson, setWordsPerLesson] = useState(5);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    expandApp();
    authenticate();
  }, []);

  const authenticate = async () => {
    const initData = tg?.initData;
    if (!initData) {
      // Development fallback — skip auth
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.auth.validate.$post({
        json: { init_data: initData },
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        const u = data.user as User;
        setUser(u);
        setLang(u.display_language as Lang);
        setWordsPerLesson(u.words_per_lesson);
      } else if (res.status === 401) {
        setAuthError("session_expired");
      } else {
        setAuthError("auth_failed");
      }
    } catch {
      setAuthError("network");
    } finally {
      setLoading(false);
    }
  };

  const goHome = useCallback(() => {
    setScreen({ name: "home" });
    setRefreshKey((k) => k + 1);
  }, []);

  if (loading) {
    return <FullScreenSpinner />;
  }

  if (authError) {
    return (
      <ErrorOverlay
        message={
          authError === "session_expired"
            ? "Session expired. Please reopen the app."
            : authError === "network"
              ? "No connection. Check your internet and try again."
              : "Something went wrong. Try again."
        }
        buttonText={authError === "session_expired" ? undefined : "Retry"}
        onRetry={authError === "session_expired" ? undefined : authenticate}
      />
    );
  }

  switch (screen.name) {
    case "home":
      return (
        <Home
          lang={lang}
          onSettings={() => setScreen({ name: "settings" })}
          onStartLesson={(mode) => setScreen({ name: "lesson", mode })}
          refreshKey={refreshKey}
        />
      );

    case "settings":
      return (
        <Settings
          lang={lang}
          wordsPerLesson={wordsPerLesson}
          onBack={goHome}
          onLangChange={(l) => setLang(l)}
          onWordsChange={(n) => setWordsPerLesson(n)}
        />
      );

    case "lesson":
      return (
        <Lesson
          mode={screen.mode}
          lang={lang}
          onComplete={(data) => setScreen({ name: "lesson_complete", data })}
          onAbandon={goHome}
        />
      );

    case "lesson_complete":
      return (
        <LessonComplete
          data={screen.data}
          lang={lang}
          onBack={goHome}
        />
      );
  }
}
