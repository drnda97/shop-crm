"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePath, useT } from "@/lib/i18n/client";

export type AnnouncementBarProps = {
  /** Poruke; bez njih trake nema. */
  items: { text: string; href: string }[];
  /** „slider": jedna po jedna, sa strelicama; „marquee": sve u nizu koji klizi. */
  mode: "slider" | "marquee";
  /** Sekundi po poruci. */
  seconds: number;
  tone: "dark" | "gold" | "light";
};

function Message({ text, href }: { text: string; href: string }) {
  const to = usePath();
  return href ? <Link href={to(href)}>{text}</Link> : <span>{text}</span>;
}

/**
 * Traka sa obaveštenjima na vrhu svake stranice (Izgled sajta → Zaglavlje). Slider menja
 * poruke sam i staje dok je miš iznad trake ili je fokus u njoj; uz „smanji pokrete" u
 * sistemu poruke se menjaju samo strelicama, a niz ne klizi.
 */
export function AnnouncementBar({ items, mode, seconds, tone }: AnnouncementBarProps) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const many = items.length > 1;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!many || mode !== "slider" || paused || still) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), seconds * 1000);
    return () => clearInterval(timer);
  }, [many, mode, paused, still, items.length, seconds]);

  if (items.length === 0) return null;
  const className = `announce tone-${tone}`;
  const hold = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  if (mode === "marquee" && many && !still) {
    // Niz je dva puta zaredom, pa se pomeranjem za polovinu vraća na početak bez skoka.
    return (
      <div className={`${className} marquee`} {...hold} data-paused={paused}>
        <div className="marquee-track" style={{ animationDuration: `${items.length * seconds * 2}s` }}>
          {[0, 1].map((copy) => (
            <div className="marquee-group" key={copy} aria-hidden={copy === 1}>
              {items.map((item, at) => (
                <Message key={at} {...item} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!many || mode === "marquee") {
    return (
      <div className={className}>
        {items.map((item, at) => (
          <span key={at} className="announce-static">
            <Message {...item} />
          </span>
        ))}
      </div>
    );
  }

  const current = items[index % items.length];
  const go = (step: number) => setIndex((index + step + items.length) % items.length);
  return (
    <div className={`${className} slider`} role="region" aria-roledescription="carousel" aria-label={t("Obaveštenja")} {...hold}>
      <button type="button" className="announce-arrow" aria-label={t("Prethodno obaveštenje")} onClick={() => go(-1)}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="announce-slide" key={index} aria-live={paused ? "polite" : "off"}>
        <Message {...current} />
      </div>
      <button type="button" className="announce-arrow" aria-label={t("Sledeće obaveštenje")} onClick={() => go(1)}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
