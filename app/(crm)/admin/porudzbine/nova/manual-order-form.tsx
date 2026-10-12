"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createManualOrderAction } from "../../actions";
import { buttonClass, fieldRowClass, inputClass, labelClass, panelClass, panelTitleClass, quietButtonClass } from "../../ui";

type ProductOption = { slug: string; name: string; variants: { id: string; label: string }[] };

type ManualOrderFormProps = {
  /** Adresa stranice porudžbine bez broja: posle upisa se otvara nova porudžbina. */
  ordersPath: string;
  products: ProductOption[];
  methods: { id: string; name: string }[];
  payments: { id: string; label: string }[];
};

type Row = { slug: string; variant: string; qty: string };

const emptyCustomer = { name: "", phone: "", email: "", street: "", city: "", postalCode: "", note: "" };

/** Porudžbina primljena telefonom ili u radnji. Cene, popust, dostavu i stanje računa server, kao i za sajt. */
export function ManualOrderForm({ ordersPath, products, methods, payments }: ManualOrderFormProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState(emptyCustomer);
  const [rows, setRows] = useState<Row[]>([{ slug: "", variant: "", qty: "1" }]);
  const [deliveryMethod, setDeliveryMethod] = useState(methods[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState(payments[0]?.id ?? "cod");
  const [discountCode, setDiscountCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const field = (key: keyof typeof emptyCustomer) => ({
    value: customer[key],
    onChange: (event: { target: { value: string } }) => setCustomer({ ...customer, [key]: event.target.value }),
    className: inputClass,
  });
  const setRow = (index: number, next: Partial<Row>) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, ...next } : row)));

  function submit() {
    const items = rows
      .filter((row) => row.slug)
      .map((row) => ({ slug: row.slug, qty: Math.max(1, Math.round(Number(row.qty) || 1)), ...(row.variant ? { variant: row.variant } : {}) }));
    if (items.length === 0) return setError("Dodajte bar jedan proizvod.");
    setError("");
    startTransition(async () => {
      const result = await createManualOrderAction({ customer, items, discountCode, paymentMethod, deliveryMethod });
      if (!result.ok) return setError(result.error);
      router.push(`${ordersPath}/${result.number}`);
    });
  }

  return (
    <div className="grid items-start gap-[16px] xl:grid-cols-2">
      <section className={panelClass}>
        <h2 className={panelTitleClass}>Proizvodi</h2>
        {rows.map((row, index) => {
          const product = products.find((candidate) => candidate.slug === row.slug);
          return (
            <div key={index} className="flex flex-wrap items-end gap-[8px]">
              <label className={`${labelClass} min-w-[200px] grow basis-0`}>
                Proizvod
                <select
                  value={row.slug}
                  onChange={(event) => {
                    const next = products.find((candidate) => candidate.slug === event.target.value);
                    setRow(index, { slug: event.target.value, variant: next?.variants[0]?.id ?? "" });
                  }}
                  className={inputClass}
                >
                  <option value="">— izaberite —</option>
                  {products.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              {product && product.variants.length > 0 && (
                <label className={`${labelClass} min-w-[160px] grow basis-0`}>
                  Varijanta
                  <select value={row.variant} onChange={(event) => setRow(index, { variant: event.target.value })} className={inputClass}>
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={`${labelClass} w-[90px]`}>
                Kom.
                <input type="number" min="1" step="1" value={row.qty} onChange={(event) => setRow(index, { qty: event.target.value })} className={inputClass} />
              </label>
              {rows.length > 1 && (
                <button type="button" className={quietButtonClass} aria-label={`Ukloni stavku ${index + 1}`} onClick={() => setRows(rows.filter((_, position) => position !== index))}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div>
          <button type="button" className={quietButtonClass} onClick={() => setRows([...rows, { slug: "", variant: "", qty: "1" }])}>
            + Stavka
          </button>
        </div>
        <div className={fieldRowClass}>
          <label className={labelClass}>
            Način dostave
            <select value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)} className={inputClass}>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Način plaćanja
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}>
              {payments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={labelClass}>
          Kod za popust (neobavezno)
          <input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} className={inputClass} />
        </label>
      </section>

      <section className={panelClass}>
        <h2 className={panelTitleClass}>Kupac</h2>
        <div className={fieldRowClass}>
          <label className={labelClass}>
            Ime i prezime
            <input autoComplete="off" {...field("name")} />
          </label>
          <label className={labelClass}>
            Telefon
            <input autoComplete="off" {...field("phone")} />
          </label>
        </div>
        <label className={labelClass}>
          Email
          <input type="email" autoComplete="off" {...field("email")} />
        </label>
        <label className={labelClass}>
          Ulica i broj
          <input autoComplete="off" {...field("street")} />
        </label>
        <div className={fieldRowClass}>
          <label className={labelClass}>
            Poštanski broj
            <input autoComplete="off" {...field("postalCode")} />
          </label>
          <label className={labelClass}>
            Mesto
            <input autoComplete="off" {...field("city")} />
          </label>
        </div>
        <label className={labelClass}>
          Napomena
          <input maxLength={500} {...field("note")} />
        </label>
        {error && (
          <p role="alert" className="rounded-[16px] bg-band px-[16px] py-[12px] text-[15px] font-medium">
            {error}
          </p>
        )}
        <div>
          <button type="button" className={buttonClass} disabled={pending} onClick={submit}>
            {pending ? "Upisujem…" : "Upiši porudžbinu"}
          </button>
        </div>
        <p className="text-[14px] text-muted">
          Kupac dobija istu potvrdu emailom kao da je poručio na sajtu, a komadi se skidaju sa stanja.
        </p>
      </section>
    </div>
  );
}
