import Image from "next/image";
import type { CSSProperties } from "react";
import { srcSet } from "@/lib/media";

/** Inline stil korenog elementa svake stranice, kao u dizajnu. */
export const DS_STYLE: CSSProperties = { fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--paper)" };

/** Fotografija koja ispunjava roditelja (.ph), sa istim isecanjem kao u dizajnu. */
export function Photo({
  src,
  alt,
  sizes,
  position,
  className = "img",
  preload,
}: {
  src: string;
  alt: string;
  sizes: string;
  position?: string;
  className?: string;
  preload?: boolean;
}) {
  // Slika ubačena iz panela već postoji u više širina (lib/media.ts), pa pregledač sam bira
  // odgovarajuću; SVG se ne smanjuje. Slike teme i stare slike idu kroz next/image.
  const sized = srcSet(src);
  if (sized || src.endsWith(".svg")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={src}
        srcSet={sized ?? undefined}
        sizes={sized ? sizes : undefined}
        alt={alt}
        loading={preload ? "eager" : "lazy"}
        fetchPriority={preload ? "high" : undefined}
        decoding="async"
        style={position ? { objectPosition: position } : undefined}
      />
    );
  }
  return (
    <Image
      className={className}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Strelica u dugmetu (.btn i). */
export function ArrowIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" strokeWidth="1.800" {...stroke}>
      <path d="M1 6h14M10 1l5 5-5 5"></path>
    </svg>
  );
}

/** Manja strelica u linku (.more i) i na pločicama kategorija. */
export function ArrowSmallIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" strokeWidth="1.800" {...stroke}>
      <path d="M1 5h12M9 1l4 4-4 4"></path>
    </svg>
  );
}

export function LeafIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" strokeWidth="1.600" {...stroke}>
      <path d="M11 20V9M11 9C11 5 8 3 4 3c0 4 2 7 7 6zM11 12c0-3 2.500-5 7-5 0 3.500-2 6-7 5z"></path>
    </svg>
  );
}

export function TruckIcon() {
  return (
    <svg width="24" height="18" viewBox="0 0 24 18" strokeWidth="1.600" {...stroke}>
      <path d="M1 2h13v11H1zM14 6h5l4 4v3h-9z"></path>
      <circle cx="6" cy="14.500" r="2.200"></circle>
      <circle cx="18" cy="14.500" r="2.200"></circle>
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" strokeWidth="1.600" {...stroke}>
      <path d="M11 1l8 3v6c0 5-3.500 9-8 11-4.500-2-8-6-8-11V4z"></path>
      <path d="M7.500 11l2.500 2.500L15 8.500"></path>
    </svg>
  );
}

export function PenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" strokeWidth="1.600" {...stroke}>
      <path d="M14 3l5 5-9 9-6 1 1-6z"></path>
      <path d="M12 5l5 5"></path>
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" strokeWidth="1.800" {...stroke}>
      <circle cx="10" cy="10" r="8.500"></circle>
      <path d="M6.200 10.300l2.600 2.600 5-5.600"></path>
    </svg>
  );
}

/** Ikonica po nazivu iz panela (lib/sections.ts, ICONS). */
export function Icon({ name }: { name: string }) {
  switch (name) {
    case "leaf":
      return <LeafIcon />;
    case "truck":
      return <TruckIcon />;
    case "shield":
      return <ShieldIcon />;
    case "pen":
      return <PenIcon />;
    default:
      return <CheckIcon />;
  }
}
