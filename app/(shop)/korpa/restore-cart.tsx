"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "../_components/cart";
import { unsubscribeCartAction } from "../actions";

/** Vraća sačuvanu korpu u pregledač kupca i vodi ga na plaćanje. */
export function RestoreCart({ items }: { items: { slug: string; variantId?: string; qty: number }[] }) {
  const { restore } = useCart();
  const router = useRouter();
  useEffect(() => {
    restore(items);
    router.replace("/placanje");
    // Jednom, pri otvaranju stranice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p className="lead">Vraćamo vašu korpu…</p>;
}

/** Odjava od podsetnika: na klik, da je ne pokrene program za poštu koji sam otvara linkove. */
export function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  if (state === "done") return <p className="lead">Odjavljeni ste. Podsetnike za korpu vam više ne šaljemo.</p>;
  return (
    <>
      <p className="lead">Ne želite podsetnike za korpu na ovu adresu?</p>
      <button className="btn" onClick={async () => setState((await unsubscribeCartAction(token)) ? "done" : "failed")}>
        Odjavi me
      </button>
      {state === "failed" && <p role="alert">Odjava nije uspela. Pokušajte ponovo ili nam pišite.</p>}
    </>
  );
}
