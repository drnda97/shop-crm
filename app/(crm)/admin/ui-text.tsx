"use client";

import { useT } from "@/lib/i18n/client";
import { sizedSrc } from "@/lib/media";

/** Trenutna slika, ili prazan okvir ako je nema. `contain`: cela slika bez sečenja (logo, favicon). */
export function Thumb({
  src,
  alt,
  contain = false,
}: {
  src?: string;
  alt: string;
  contain?: boolean;
}) {
  const t = useT();
  const frame = "h-[80px] w-[64px] shrink-0 rounded-[14px] bg-ph";
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center text-center text-[11px] text-muted ${frame}`}
      >
        {t("bez slike")}
      </div>
    );
  }
  return (
    // Sličica je najmanja veličina slike; stare slike i SVG se prikazuju kakvi jesu.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sizedSrc(src, 320)}
      alt={alt}
      width={64}
      height={80}
      loading="lazy"
      className={`${contain ? "object-contain p-[6px]" : "object-cover"} ${frame}`}
    />
  );
}

/**
 * Upozorenje tamo gde panel šalje email kupcu, dok email nije povezan: prodavnica šalje poruke
 * preko SMTP naloga svog domena, koji se upisuje u Podešavanjima.
 */
export function MailNotice({ configured, settingsPath }: { configured: boolean; settingsPath: string }) {
  const t = useT();
  if (configured) return null;
  return (
    <p role="status" className="mb-[16px] rounded-[18px] bg-white px-[18px] py-[14px] text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-gold)]">
      <strong>{t("Email nije povezan,")}</strong> {t("pa kupci ne dobijaju potvrde, poruke o statusu ni podsetnike. Upišite SMTP nalog svog domena u")}{" "}
      <a href={`${settingsPath}#email`} className="font-display font-bold underline">
        {t("Podešavanja → Email o porudžbini")}
      </a>
      .
    </p>
  );
}

/** Tekst koji stiže sa servera na srpskom (poruka akcije u adresi, naziv iz jezgra), na jeziku panela. */
export function Tr({ children }: { children: string }) {
  return useT()(children);
}
