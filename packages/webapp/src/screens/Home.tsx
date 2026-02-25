import React, { useEffect, useState } from "react";
import { apiClient } from "../api.js";
import { t, type Lang } from "../i18n.js";
import { hapticLight } from "../telegram.js";

interface HomeProps {
  lang: Lang;
  onSettings: () => void;
  onStartLesson: (mode: "new" | "continue" | "review") => void;
  refreshKey: number;
}

interface Stats {
  new_available: number;
  continue_available: number;
  review_available: number;
  total_words: number;
  learned_words: number;
}

export function Home({ lang, onSettings, onStartLesson, refreshKey }: HomeProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const i = t(lang);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.learn.stats.$get();
      if (res.ok) {
        const data = await res.json();
        setStats(data as Stats);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "20px", color: "var(--tg-theme-text-color)" }}>🇬🇷 {i.appTitle}</h1>
          <button onClick={() => { hapticLight(); onSettings(); }} style={gearStyle}>⚙️</button>
        </div>
        <div style={skeletonStyle} />
        <div style={{ ...skeletonStyle, height: "48px", marginTop: "16px" }} />
        <div style={{ ...skeletonStyle, height: "48px", marginTop: "8px" }} />
        <div style={{ ...skeletonStyle, height: "48px", marginTop: "8px" }} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--tg-theme-text-color)" }}>
        <p>{i.somethingWrong}</p>
        <button onClick={fetchStats} style={btnStyle}>{i.retry}</button>
      </div>
    );
  }

  const pct = stats.total_words > 0 ? Math.round((stats.learned_words / stats.total_words) * 100) : 0;
  const allZero = stats.new_available === 0 && stats.continue_available === 0 && stats.review_available === 0;

  return (
    <div style={{ padding: "24px", color: "var(--tg-theme-text-color)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>🇬🇷 {i.appTitle}</h1>
        <button onClick={() => { hapticLight(); onSettings(); }} style={gearStyle}>⚙️</button>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <p style={{ margin: "0 0 8px", fontSize: "16px" }}>
          {stats.learned_words} / {stats.total_words} {i.wordsLearned}
        </p>
        <div style={{ width: "100%", height: "8px", backgroundColor: "rgba(128,128,128,0.2)", borderRadius: "4px" }}>
          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--tg-theme-button-color)", borderRadius: "4px", transition: "width 0.3s" }} />
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "12px", opacity: 0.6 }}>{pct}%</p>
      </div>

      {allZero ? (
        <p style={{ textAlign: "center", opacity: 0.7, marginTop: "32px" }}>{i.allCaughtUp}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <ModeButton
            emoji="📗"
            label={i.learnNew}
            count={stats.new_available}
            disabled={stats.new_available === 0}
            onClick={() => onStartLesson("new")}
          />
          <ModeButton
            emoji="📙"
            label={i.continue}
            count={stats.continue_available}
            disabled={stats.continue_available === 0}
            onClick={() => onStartLesson("continue")}
          />
          <ModeButton
            emoji="📘"
            label={i.review}
            count={stats.review_available}
            disabled={stats.review_available === 0}
            onClick={() => onStartLesson("review")}
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({ emoji, label, count, disabled, onClick }: {
  emoji: string;
  label: string;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => { if (!disabled) { hapticLight(); onClick(); } }}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        border: "none",
        borderRadius: "12px",
        backgroundColor: disabled ? "rgba(128,128,128,0.1)" : "var(--tg-theme-button-color)",
        color: disabled ? "rgba(128,128,128,0.5)" : "var(--tg-theme-button-text-color)",
        fontSize: "16px",
        cursor: disabled ? "default" : "pointer",
        width: "100%",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span>{emoji} {label}</span>
      <span>({count})</span>
    </button>
  );
}

const gearStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "20px",
  cursor: "pointer",
  padding: "4px",
};

const skeletonStyle: React.CSSProperties = {
  height: "24px",
  backgroundColor: "rgba(128,128,128,0.15)",
  borderRadius: "8px",
  animation: "pulse 1.5s infinite",
};

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  backgroundColor: "var(--tg-theme-button-color)",
  color: "var(--tg-theme-button-text-color)",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "16px",
};
