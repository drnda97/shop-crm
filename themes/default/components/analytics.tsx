"use client";

import { useT } from "@/lib/i18n/client";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCart } from "./cart";
import { createStore } from "./store";

/**
 * Merenje poseta (Google Analytics 4, Meta Pixel) i traka za kolačiće. Kodovi se učitavaju
 * tek kada posetilac pristane; bez upisanih oznaka u panelu nema ni trake ni kolačića za praćenje.
 */

type Consent = { decided: boolean; analytics: boolean; marketing: boolean };

const store = createStore<Consent>("shop:consent", { decided: false, analytics: false, marketing: false }, (value) => ({
  decided: value?.decided === true,
  analytics: value?.analytics === true,
  marketing: value?.marketing === true,
}));

type Tracker = (...args: unknown[]) => void;
type Tracked = Window & { dataLayer?: unknown[]; gtag?: Tracker; fbq?: Tracker };

function loadScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Događaj kupovine za alate koji su učitani (posle pristanka): dodavanje u korpu, porudžbina. */
export function track(event: "add_to_cart" | "purchase", data: { value: number; currency: string; id?: string }) {
  const view = window as Tracked;
  view.gtag?.("event", event, { value: data.value, currency: data.currency, ...(data.id ? { transaction_id: data.id } : {}) });
  view.fbq?.("track", event === "purchase" ? "Purchase" : "AddToCart", { value: data.value, currency: data.currency });
}

export function Analytics() {
  const t = useT();
  const { ga4, metaPixel } = useCart().config.analytics;
  const consent = store.use();
  const pathname = usePathname();
  const [reopened, setReopened] = useState(false);
  // Traka se crta tek u pregledaču: na serveru se ne zna da li je posetilac već odlučio.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const hasAnalytics = ga4 !== "";
  const hasMarketing = metaPixel !== "";

  // Google Analytics: učitava se jednom, posle pristanka na analitiku.
  useEffect(() => {
    const view = window as Tracked;
    if (!hasAnalytics || !consent.analytics || view.gtag) return;
    view.dataLayer = view.dataLayer ?? [];
    view.gtag = function gtag() {
      // gtag očekuje baš objekat `arguments`.
      // eslint-disable-next-line prefer-rest-params
      view.dataLayer?.push(arguments);
    };
    view.gtag("js", new Date());
    view.gtag("config", ga4, { anonymize_ip: true });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${ga4}`);
  }, [hasAnalytics, consent.analytics, ga4]);

  // Meta Pixel: posle pristanka na marketing.
  useEffect(() => {
    const view = window as Tracked;
    if (!hasMarketing || !consent.marketing || view.fbq) return;
    // Isto što radi Metin kod za ugradnju: pozivi se ređaju dok se njihova skripta ne učita.
    type Pixel = Tracker & { callMethod?: Tracker; queue: unknown[]; push: Tracker; loaded: boolean; version: string };
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Pixel;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    view.fbq = fbq;
    (view as Tracked & { _fbq?: unknown })._fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", metaPixel);
    fbq("track", "PageView");
  }, [hasMarketing, consent.marketing, metaPixel]);

  // Prelazak na drugu stranicu unutar sajta je nova poseta stranice.
  useEffect(() => {
    const view = window as Tracked;
    if (consent.analytics) view.gtag?.("event", "page_view", { page_path: pathname });
    if (consent.marketing) view.fbq?.("track", "PageView");
  }, [pathname, consent.analytics, consent.marketing]);

  // Link „Kolačići" u podnožju ponovo otvara traku.
  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener("shop:cookies", open);
    return () => window.removeEventListener("shop:cookies", open);
  }, []);

  if (!mounted || (!hasAnalytics && !hasMarketing)) return null;
  if (consent.decided && !reopened) return null;

  const decide = (analytics: boolean, marketing: boolean) => {
    store.write({ decided: true, analytics: analytics && hasAnalytics, marketing: marketing && hasMarketing });
    setReopened(false);
  };

  return (
    <div className="consent" role="dialog" aria-label={t("Kolačići")}>
      <p>
        {t("Koristimo kolačiće da izmerimo posete i poboljšamo prodavnicu. Bez vašeg pristanka koristimo samo one bez kojih korpa i prijava ne rade.")}
      </p>
      <div className="consent-actions">
        <button className="btn ghost" type="button" onClick={() => decide(false, false)}>{t("Samo neophodni")}</button>
        <button className="btn" type="button" onClick={() => decide(true, true)}>{t("Prihvatam")}</button>
      </div>
    </div>
  );
}

/** Link u podnožju koji ponovo otvara traku; prikazuje se samo kada sajt meri posete. */
export function CookieLink() {
  const t = useT();
  const { ga4, metaPixel } = useCart().config.analytics;
  if (!ga4 && !metaPixel) return null;
  return (
    <button className="txt-btn" type="button" onClick={() => window.dispatchEvent(new Event("shop:cookies"))} style={{ minHeight: 0, fontSize: "14px" }}>
      {t("Kolačići")}
    </button>
  );
}
