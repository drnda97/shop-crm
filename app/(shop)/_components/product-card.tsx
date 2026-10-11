"use client";

import Link from "next/link";
import { formatPrice, type ShopProduct } from "@/lib/storefront/products";
import { useCart } from "./cart";
import { Photo } from "./ui";

export function ProductCard({ product: p }: { product: ShopProduct }) {
  const { add } = useCart();
  const href = `/proizvod/${p.slug}`;

  return (
    <article className="card">
      <Link className="ph card-media" href={href} aria-label={p.name}>
        {p.image && <Photo src={p.image} alt="" sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 320px" />}
        {p.tag && <span className={p.oldPrice ? "tag sale" : "tag"}>{p.tag}</span>}
      </Link>
      <div className="card-body">
        <div className="card-cat">{p.category}</div>
        <Link className="card-name" href={href}>
          {p.name}
        </Link>
        <div className="card-row">
          <span className="card-price">
            {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
            {p.priceFrom && "od "}
            {formatPrice(p.price)}
          </span>
          {p.variants.length > 0 ? (
            // Proizvod sa varijantama se bira na svojoj stranici.
            <Link className="add" href={href} aria-label={`Izaberite opcije: ${p.name}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2v12M2 8h12"></path>
              </svg>
            </Link>
          ) : (
            <button
              className="add"
              aria-label="Dodaj u korpu"
              onClick={() => add({ slug: p.slug, variant: p.variant, qty: 1 })}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2v12M2 8h12"></path>
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
