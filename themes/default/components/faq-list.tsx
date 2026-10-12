"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
const ALL = "Sve";

type FaqListProps = {
  items: { topic: string; question: string; answer: string }[];
  /** Tema otvorena na početku; prazno: sva pitanja. */
  initialTopic: string;
};

/** Pitanja iz panela; teme za filter su one koje su upisane uz pitanja. */
export function FaqList({ items, initialTopic }: FaqListProps) {
  const t = useT();
  const topics = [ALL, ...new Set(items.map((item) => item.topic).filter(Boolean))];
  const [topic, setTopic] = useState(initialTopic || ALL);
  const [open, setOpen] = useState(0);
  const list = items.filter((item) => topic === ALL || item.topic === topic);

  return (
    <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 5vw, 88px)", alignItems: "flex-start" }}>
      {topics.length > 2 && (
      <div className="sticky panel a2" style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "16px", padding: "22px" }}>
        <div className="lab">{t("Teme")}</div>
        <div role="group" aria-label={t("Teme")} style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {topics.map((n) => (
            <button
              className={n === topic ? "chip on" : "chip"}
              onClick={() => {
                setTopic(n);
                setOpen(0);
              }}
              style={{ backgroundColor: n === topic ? "var(--ink)" : "var(--paper)" }}
              key={n}
            >
              {n === ALL ? t(n) : n}
            </button>
          ))}
        </div>
      </div>
      )}
      <div style={{ flex: "999 1 520px", minWidth: 0, borderTop: "1px solid var(--line)" }}>
        {list.map((x, i) => (
          <div className={i === open ? "acc open" : "acc"} key={i}>
            <button className="acc-h" aria-expanded={i === open} onClick={() => setOpen(i === open ? -1 : i)}>
              <span>{x.question}</span>
              <span className="plus"></span>
            </button>
            <div className="acc-b">
              <div>
                <p>{x.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
