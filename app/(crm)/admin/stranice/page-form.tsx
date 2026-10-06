import type { Page } from "@/lib/catalog";
import { savePageAction } from "../actions";
import { buttonClass, Checkbox, inputClass, labelClass, panelClass } from "../ui";

/** Naslov, tekst i link u podnožju; bez `page` pravi novu stranicu. */
export function PageForm({ page }: { page?: Page }) {
  return (
    <form action={savePageAction} className={panelClass}>
      <input type="hidden" name="slug" value={page?.slug ?? ""} />
      <label className={labelClass}>
        Naslov *
        <input name="title" required defaultValue={page?.title} className={inputClass} />
      </label>
      <label className={labelClass}>
        Tekst — prazan red razdvaja pasuse
        <textarea name="body" defaultValue={page?.body} className={`${inputClass} min-h-[320px]`} />
      </label>
      <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
        <Checkbox name="showInFooter" defaultChecked={page?.showInFooter ?? true} />
        Prikaži link u podnožju sajta (API ga vraća u spisku „footerPages“)
      </label>
      <div>
        <button type="submit" className={buttonClass}>
          {page ? "Sačuvaj" : "Napravi stranicu"}
        </button>
      </div>
    </form>
  );
}
