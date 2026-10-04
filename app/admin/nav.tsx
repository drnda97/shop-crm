"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  /** Aktivan samo na tačno toj adresi (za „Pregled", čija je adresa koren panela). */
  exact?: boolean;
  children: ReactNode;
};

/** Link u bočnom meniju; označen je dok je otvorena njegova stranica ili neka ispod nje. */
export function NavLink({ href, exact = false, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[40px] items-center justify-between gap-[8px] rounded-[6px] px-[12px] text-[15px] ${
        active ? "bg-ink text-paper hover:text-paper" : "text-ink hover:bg-band hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
