import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { buttonClass, cardClass, quietButtonClass } from "./ui";

/** Deo panela ili zapis koji ne postoji: pogrešna adresa, obrisana porudžbina, proizvod ili članak. */
export default async function AdminNotFound() {
  const t = await getPanelT();
  return (
    <div className={`${cardClass} flex max-w-[640px] flex-col items-start gap-[14px]`}>
      <title>{t("Nije pronađeno")}</title>
      <span className="eyebrow">{t("Greška 404")}</span>
      <h1 className="text-[clamp(28px,3vw,38px)] leading-[1.1] tracking-[-0.02em]">{t("Ovo ne postoji u panelu")}</h1>
      <p className="text-[15.5px] text-muted">
        {t("Adresa je pogrešna, ili je ono što tražite (porudžbina, proizvod, članak) obrisano. Vratite se na pregled ili potražite porudžbinu.")}
      </p>
      <div className="mt-[6px] flex flex-wrap gap-[10px]">
        <Link href={ADMIN_PATH} className={buttonClass}>
          {t("Na pregled")}
        </Link>
        <Link href={`${ADMIN_PATH}/porudzbine`} className={quietButtonClass}>
          {t("Porudžbine")}
        </Link>
        <Link href={`${ADMIN_PATH}/proizvodi`} className={quietButtonClass}>
          {t("Proizvodi")}
        </Link>
      </div>
    </div>
  );
}
