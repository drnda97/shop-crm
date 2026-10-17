import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getCollections } from "@/lib/content";
import { formatProductCount } from "@/lib/format";
import { deleteCollectionAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { buttonClass, cardClass, PageHeader, Pager, paginate, quietButtonClass, rowClass } from "../ui";

type CollectionsPageProps = { searchParams: Promise<{ greska?: string; strana?: string }> };

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const { greska, strana } = await searchParams;
  const collections = await getCollections();
  const list = paginate(collections, strana);

  return (
    <>
      <PageHeader
        title={t("Kolekcije")}
        hint={t("Kolekcija je ručno složena grupa proizvoda, npr. „Izdvojeno“ za početnu stranu ili „Za poklon“. Proizvod može biti u više kolekcija.")}
        error={greska}
        action={
          <Link href={`${ADMIN_PATH}/kolekcije/nova`} className={buttonClass}>
            {t("Nova kolekcija")}
          </Link>
        }
      />
      <div className={cardClass}>
        {list.shown.map((collection) => (
          <div key={collection.id} className={rowClass}>
            <div className="min-w-[180px] grow">
              <div className="text-[17px]">{collection.name}</div>
              <div className="text-[14px] text-muted">
                {t(formatProductCount(collection.productSlugs.length))} {t("· oznaka za API:")}{" "}
                {collection.id}
              </div>
            </div>
            <Link href={`${ADMIN_PATH}/kolekcije/${collection.id}`} className={quietButtonClass}>
              {t("Izmeni")}
            </Link>
            <form action={deleteCollectionAction}>
              <input type="hidden" name="id" value={collection.id} />
              <ConfirmButton
                question={t("Obrisati kolekciju „{a}\"? Proizvodi ostaju.", { a: collection.name })}
                className={quietButtonClass}
              >
                {t("Obriši")}
              </ConfirmButton>
            </form>
          </div>
        ))}
        {collections.length === 0 && <p className="text-[15px] text-muted">{t("Još nema kolekcija.")}</p>}
      </div>

      {collections.length > 0 && (
        <Pager path={`${ADMIN_PATH}/kolekcije`} page={list.page} pages={list.pages} summary={t("Kolekcija: {a}", { a: collections.length })} />
      )}
    </>
  );
}
