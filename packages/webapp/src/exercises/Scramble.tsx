import React, { useState, useEffect } from "react";
import { hapticLight, hapticSuccess, hapticError } from "../telegram.js";
import { t, type Lang } from "../i18n.js";

interface ScrambleProps {
  prompt: { translation: string; scrambled: string[][] };
  answer: { original: string };
  lang: Lang;
  onComplete: (result: { is_correct: boolean; answer_given: string }) => void;
}

export function Scramble({ prompt, answer, lang, onComplete }: ScrambleProps) {
  const [groups, setGroups] = useState<{ slots: (string | null)[]; available: { char: string; used: boolean }[] }[]>([]);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const i = t(lang);

  useEffect(() => {
    setGroups(
      prompt.scrambled.map((chars) => ({
        slots: chars.map(() => null),
        available: chars.map((c) => ({ char: c, used: false })),
      })),
    );
  }, [prompt.scrambled]);

  useEffect(() => {
    if (result !== null) {
      const timer = setTimeout(() => {
        const assembled = groups
          .map((g) => g.slots.join(""))
          .join(" ");
        onComplete({
          is_correct: result === "correct",
          answer_given: assembled,
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handlePlaceLetter = (groupIdx: number, availIdx: number) => {
    if (result !== null) return;
    hapticLight();

    setGroups((prev) => {
      const next = prev.map((g) => ({
        slots: [...g.slots],
        available: g.available.map((a) => ({ ...a })),
      }));
      const group = next[groupIdx];
      const emptySlot = group.slots.indexOf(null);
      if (emptySlot === -1) return prev;

      group.slots[emptySlot] = group.available[availIdx].char;
      group.available[availIdx].used = true;
      return next;
    });
  };

  const handleRemoveLetter = (groupIdx: number, slotIdx: number) => {
    if (result !== null) return;
    hapticLight();

    setGroups((prev) => {
      const next = prev.map((g) => ({
        slots: [...g.slots],
        available: g.available.map((a) => ({ ...a })),
      }));
      const group = next[groupIdx];
      const char = group.slots[slotIdx];
      if (!char) return prev;

      group.slots[slotIdx] = null;
      // Find first matching unused available slot to restore
      const availIdx = group.available.findIndex((a) => a.char === char && a.used);
      if (availIdx !== -1) {
        group.available[availIdx].used = false;
      }

      // Compact: shift remaining letters left
      const filled = group.slots.filter((s) => s !== null);
      const newSlots = [...filled, ...Array(group.slots.length - filled.length).fill(null)];
      group.slots = newSlots;

      return next;
    });
  };

  const allFilled = groups.every((g) => g.slots.every((s) => s !== null));

  const handleCheck = () => {
    const assembled = groups.map((g) => g.slots.join("")).join(" ");
    if (assembled === answer.original) {
      setResult("correct");
      hapticSuccess();
    } else {
      setResult("incorrect");
      hapticError();
    }
  };

  return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
      <div style={{ fontSize: "24px", color: "var(--tg-theme-text-color)" }}>
        {prompt.translation}
      </div>

      {/* Slots */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <div style={{ display: "flex", alignItems: "center", fontSize: "20px", opacity: 0.3 }}>·</div>
            )}
            <div style={{ display: "flex", gap: "4px" }}>
              {group.slots.map((char, si) => (
                <button
                  key={si}
                  onClick={() => handleRemoveLetter(gi, si)}
                  style={{
                    width: "36px",
                    height: "40px",
                    border: char
                      ? "2px solid var(--tg-theme-button-color)"
                      : "2px dashed rgba(128,128,128,0.3)",
                    borderRadius: "6px",
                    backgroundColor: char ? "rgba(128,128,128,0.05)" : "transparent",
                    color: "var(--tg-theme-text-color)",
                    fontSize: "18px",
                    fontWeight: "bold",
                    cursor: char ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {char}
                </button>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Available letters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ display: "flex", gap: "4px" }}>
            {group.available.map((item, ai) => (
              <button
                key={ai}
                onClick={() => handlePlaceLetter(gi, ai)}
                disabled={item.used || result !== null}
                style={{
                  width: "36px",
                  height: "40px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: item.used ? "rgba(128,128,128,0.05)" : "var(--tg-theme-button-color)",
                  color: item.used ? "transparent" : "var(--tg-theme-button-text-color)",
                  fontSize: "18px",
                  fontWeight: "bold",
                  cursor: item.used ? "default" : "pointer",
                  opacity: item.used ? 0.2 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.char}
              </button>
            ))}
          </div>
        ))}
      </div>

      {result === "incorrect" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--tg-theme-text-color)" }}>
            {answer.original}
          </div>
        </div>
      )}

      {result === null && (
        <button
          onClick={handleCheck}
          disabled={!allFilled}
          style={{
            padding: "14px 32px",
            backgroundColor: allFilled ? "var(--tg-theme-button-color)" : "rgba(128,128,128,0.2)",
            color: allFilled ? "var(--tg-theme-button-text-color)" : "rgba(128,128,128,0.5)",
            border: "none",
            borderRadius: "12px",
            fontSize: "16px",
            cursor: allFilled ? "pointer" : "default",
          }}
        >
          {i.check}
        </button>
      )}
    </div>
  );
}
