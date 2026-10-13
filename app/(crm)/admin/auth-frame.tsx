import Image from "next/image";
import type { ReactNode } from "react";
import { getPanelT } from "@/lib/i18n/server";

/** Znak prodavnice: senf tačka i naziv, kao logo u prodavnici. */
function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-[8px] font-display text-[22px] leading-none font-extrabold tracking-[-0.04em]">
      <span className="size-[10px] shrink-0 rounded-full bg-gold" />
      {name}
    </div>
  );
}

/** Okvir stranica pre prijave: fotografija levo, forma desno. */
export async function AuthFrame({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  const t = await getPanelT();
  return (
    <main className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-[clamp(24px,4vw,72px)] bg-paper p-[16px]">
      <div className="relative min-h-[clamp(240px,40vw,400px)] overflow-hidden rounded-[36px] bg-ink text-paper md:min-h-0">
        <Image
          src="/shop/ds-cognac.jpg"
          alt=""
          fill
          preload
          sizes="(max-width: 860px) 100vw, 50vw"
          className="animate-kb object-cover"
        />
        <div className="absolute inset-0 bg-[rgba(8,22,28,.3)]" />
        <div className="absolute inset-x-[clamp(22px,3vw,44px)] bottom-[clamp(22px,3vw,44px)] flex flex-col gap-[12px]">
          <div className="max-w-[15ch] animate-fade font-display text-[clamp(26px,2.8vw,40px)] leading-[1.04] font-bold tracking-[-0.03em] [animation-delay:.3s]">
            {t("Proizvodi, porudžbine i kupci na jednom mestu")}
          </div>
          <p className="max-w-[38ch] animate-fade text-[#DDE5E6] [animation-delay:.42s]">
            {t("Panel iz kog vodite prodavnicu: katalog, popuste, poruke i podešavanja.")}
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center py-[clamp(8px,2vw,32px)]">
        <div className="mx-auto flex w-full max-w-[420px] animate-fade flex-col gap-[26px]">
          <Brand name={name} />
          <div className="flex flex-col gap-[8px]">
            <h1 className="text-[clamp(34px,4.2vw,56px)] leading-[1.04] tracking-[-0.03em]">
              <span className="rise">
                <span>{t("Admin panel")}</span>
              </span>
            </h1>
            <p className="text-muted">{hint}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
