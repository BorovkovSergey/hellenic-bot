import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api.js";
import { t, type Lang } from "../i18n.js";
import { showBackButton, hapticLight } from "../telegram.js";
import { Toast } from "../components/Toast.js";

interface SettingsProps {
  lang: Lang;
  wordsPerLesson: number;
  onBack: () => void;
  onLangChange: (lang: Lang) => void;
  onWordsChange: (n: number) => void;
}

export function Settings({ lang, wordsPerLesson, onBack, onLangChange, onWordsChange }: SettingsProps) {
  const [wpl, setWpl] = useState(wordsPerLesson);
  const [currentLang, setCurrentLang] = useState(lang);
  const [toast, setToast] = useState<string | null>(null);
  const i = t(currentLang);

  useEffect(() => {
    return showBackButton(onBack);
  }, [onBack]);

  const saveSetting = async (field: "display_language" | "words_per_lesson", value: string | number, rollback: () => void) => {
    try {
      const body = field === "display_language"
        ? { display_language: value as "en" | "ru" }
        : { words_per_lesson: value as number };
      const res = await apiClient.users.me.settings.$patch({ json: body });
      if (!res.ok) {
        rollback();
        setToast(i.failedToSave);
      }
    } catch {
      rollback();
      setToast(i.failedToSave);
    }
  };

  const handleWplChange = (delta: number) => {
    const newVal = wpl + delta;
    if (newVal < 1 || newVal > 20) return;
    hapticLight();
    const prev = wpl;
    setWpl(newVal);
    onWordsChange(newVal);
    saveSetting("words_per_lesson", newVal, () => {
      setWpl(prev);
      onWordsChange(prev);
    });
  };

  const handleLangChange = (newLang: Lang) => {
    if (newLang === currentLang) return;
    hapticLight();
    const prev = currentLang;
    setCurrentLang(newLang);
    onLangChange(newLang);
    saveSetting("display_language", newLang, () => {
      setCurrentLang(prev);
      onLangChange(prev);
    });
  };

  return (
    <div style={{ padding: "24px", color: "var(--tg-theme-text-color)" }}>
      <h1 style={{ fontSize: "20px", margin: "0 0 32px" }}>{i.settings}</h1>

      <div style={{ marginBottom: "32px" }}>
        <label style={{ display: "block", marginBottom: "12px", fontSize: "14px", opacity: 0.7 }}>
          {i.wordsPerLesson}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => handleWplChange(-1)}
            disabled={wpl <= 1}
            style={stepperBtnStyle(wpl <= 1)}
          >
            ◀
          </button>
          <span style={{ fontSize: "20px", fontWeight: "bold", minWidth: "32px", textAlign: "center" }}>
            {wpl}
          </span>
          <button
            onClick={() => handleWplChange(1)}
            disabled={wpl >= 20}
            style={stepperBtnStyle(wpl >= 20)}
          >
            ▶
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "12px", fontSize: "14px", opacity: 0.7 }}>
          {i.language}
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <ToggleBtn label="EN" active={currentLang === "en"} onClick={() => handleLangChange("en")} />
          <ToggleBtn label="RU" active={currentLang === "ru"} onClick={() => handleLangChange("ru")} />
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        border: active ? "none" : "1px solid rgba(128,128,128,0.3)",
        borderRadius: "8px",
        backgroundColor: active ? "var(--tg-theme-button-color)" : "transparent",
        color: active ? "var(--tg-theme-button-text-color)" : "var(--tg-theme-text-color)",
        fontSize: "14px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function stepperBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "40px",
    height: "40px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: disabled ? "rgba(128,128,128,0.1)" : "var(--tg-theme-button-color)",
    color: disabled ? "rgba(128,128,128,0.4)" : "var(--tg-theme-button-text-color)",
    fontSize: "16px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
