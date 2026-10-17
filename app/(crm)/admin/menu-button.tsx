"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuButtonProps = {
  /** Natpis dugmeta, već preveden. */
  label: string;
  className: string;
  /** Stavke menija: natpis, adresa i kratko objašnjenje ispod natpisa. */
  items: { label: string; href: string; hint?: string }[];
};

/**
 * Dugme sa padajućim menijem linkova (npr. Izvoz → Excel, CSV). Zatvara se izborom stavke,
 * klikom pored menija i tasterom Esc. Meni se iscrtava u <body> (portal), pa je uvek iznad
 * ostatka stranice: delovi sa animacijom ulaska prave svoj sloj i inače bi ga prekrili.
 */
export function MenuButton({ label, className, items }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  // Mesto menija na ekranu: ispod dugmeta, poravnat sa njegovom desnom ivicom.
  const [place, setPlace] = useState({ top: 0, right: 0 });
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function toggle() {
    const box = root.current?.getBoundingClientRect();
    if (box) setPlace({ top: box.bottom + 8, right: window.innerWidth - box.right });
    setOpen(!open);
  }

  useEffect(() => {
    if (!open) return;
    const follow = () => {
      const box = root.current?.getBoundingClientRect();
      if (box) setPlace({ top: box.bottom + 8, right: window.innerWidth - box.right });
    };
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={toggle} className={`${className} gap-[8px]`}>
        {label}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ top: place.top, right: place.right }}
            className="fixed z-50 flex min-w-[240px] animate-pop flex-col rounded-[20px] bg-white p-[6px] shadow-[0_24px_60px_-20px_rgba(14,39,48,0.45),0_0_0_1px_var(--color-line)]"
          >
            {items.map((item) => (
              <a
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex flex-col rounded-[14px] px-[14px] py-[10px] font-display text-[14.5px] font-bold text-ink transition-colors duration-200 hover:bg-band hover:text-ink"
              >
                {item.label}
                {item.hint && <span className="font-sans text-[13px] font-normal text-muted">{item.hint}</span>}
              </a>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
