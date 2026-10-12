/**
 * Načini dostave: svaki ima svoju cenu (stalnu ili po težini), prag za besplatnu dostavu i,
 * po želji, zonu — poštanske brojeve u koje se isporučuje. Menjaju se u panelu
 * (Podešavanja → Dostava). Bez pristupa bazi, pa sme i u "use client" komponente.
 */

export type ShippingMethod = {
  id: string;
  /** Naziv koji kupac vidi pri poručivanju, npr. „Kurirska služba". */
  name: string;
  /** Objašnjenje ispod naziva: rok, kurir. */
  hint: string;
  /** „pickup": kupac preuzima sam, pa se adresa za dostavu ne koristi. */
  kind: "delivery" | "pickup";
  /** Cena u najmanjim jedinicama valute; važi kada nema cena po težini. */
  price: number;
  /** Vrednost proizvoda (posle popusta) od koje je ovaj način besplatan; null: uvek se naplaćuje. */
  freeFrom: number | null;
  /** Cena po težini porudžbine: prvi red čija granica (u gramima) pokriva težinu. Prazno: stalna cena. */
  weightRates: { upTo: number; price: number }[];
  /** Zona: počeci poštanskih brojeva razdvojeni zarezom („11, 21"). Prazno: svuda. */
  zone: string;
  /** Rečenica koju kupac vidi posle porudžbine, npr. kada i kako stiže. */
  confirmation: string;
};

export const MAX_METHODS = 12;

/** Cena načina dostave za datu težinu, pre provere besplatne dostave. */
export function basePrice(method: ShippingMethod, weight: number): number {
  const rates = [...method.weightRates].sort((a, b) => a.upTo - b.upTo);
  if (rates.length === 0) return method.price;
  // Teže od poslednje granice: važi cena poslednjeg reda.
  return (rates.find((rate) => weight <= rate.upTo) ?? rates[rates.length - 1]).price;
}

/** Koliko kupac plaća dostavu: `amount` je vrednost proizvoda posle popusta, `weight` u gramima. */
export function methodPrice(method: ShippingMethod, amount: number, weight: number): number {
  if (method.freeFrom !== null && amount >= method.freeFrom) return 0;
  return basePrice(method, weight);
}

/** Da li se način nudi za dati poštanski broj. Dok broj nije upisan, nude se svi. */
export function methodServes(method: ShippingMethod, postalCode: string): boolean {
  const prefixes = method.zone.split(",").map((prefix) => prefix.replace(/\s/g, "")).filter(Boolean);
  const code = postalCode.replace(/\s/g, "");
  if (prefixes.length === 0 || code === "") return true;
  return prefixes.some((prefix) => code.startsWith(prefix));
}

export function availableMethods(methods: ShippingMethod[], postalCode: string): ShippingMethod[] {
  return methods.filter((method) => methodServes(method, postalCode));
}

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

/** Zapis iz baze ili iz pregledača sveden na ispravne načine dostave. */
export function normalizeMethods(raw: unknown): ShippingMethod[] {
  const ids = new Set<string>();
  return (Array.isArray(raw) ? raw : []).slice(0, MAX_METHODS).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const item = entry as Record<string, unknown>;
    const name = asText(item.name, 120);
    if (!name) return [];
    let id = typeof item.id === "string" && /^[a-z0-9-]{1,60}$/.test(item.id) ? item.id : "dostava";
    for (let n = 2; ids.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
    ids.add(id);
    return [
      {
        id,
        name,
        hint: asText(item.hint, 300),
        kind: item.kind === "pickup" ? "pickup" : "delivery",
        price: asAmount(item.price),
        freeFrom: typeof item.freeFrom === "number" && item.freeFrom > 0 ? Math.round(item.freeFrom) : null,
        weightRates: (Array.isArray(item.weightRates) ? item.weightRates : [])
          .slice(0, 12)
          .flatMap((rate) => {
            const { upTo, price } = (typeof rate === "object" && rate !== null ? rate : {}) as Record<string, unknown>;
            return typeof upTo === "number" && upTo > 0 ? [{ upTo: Math.round(upTo), price: asAmount(price) }] : [];
          }),
        zone: asText(item.zone, 500).replace(/[^\d,\s]/g, ""),
        confirmation: asText(item.confirmation, 500),
      },
    ];
  });
}

/** Podešavanja dostave iz prve verzije (jedna cena, prag, preuzimanje) kao načini dostave. */
export function legacyMethods(
  legacy: { price?: number; freeEnabled?: boolean; freeFrom?: number; pickupEnabled?: boolean },
  labels: { deliveryLabel?: string; deliveryHint?: string; pickupLabel?: string; pickupHint?: string; thanksDelivery?: string; thanksPickup?: string } = {},
): ShippingMethod[] {
  const methods: ShippingMethod[] = [
    {
      id: "dostava",
      name: labels.deliveryLabel || "Dostava na adresu",
      hint: labels.deliveryHint ?? "",
      kind: "delivery",
      price: asAmount(legacy.price),
      freeFrom: legacy.freeEnabled && legacy.freeFrom ? legacy.freeFrom : null,
      weightRates: [],
      zone: "",
      confirmation: labels.thanksDelivery ?? "",
    },
  ];
  if (legacy.pickupEnabled) {
    methods.push({
      id: "preuzimanje",
      name: labels.pickupLabel || "Lično preuzimanje",
      hint: labels.pickupHint ?? "",
      kind: "pickup",
      price: 0,
      freeFrom: null,
      weightRates: [],
      zone: "",
      confirmation: labels.thanksPickup ?? "",
    });
  }
  return methods;
}
