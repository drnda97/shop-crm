"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NAV_COOKIE } from "./nav-cookie";

const stroke = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "shrink-0",
} as const;

const icons = {
  overview: (
    <svg {...stroke}>
      <rect x="2.5" y="2.5" width="6" height="7" rx="1.5" />
      <rect x="11.5" y="2.5" width="6" height="4" rx="1.5" />
      <rect x="11.5" y="9.5" width="6" height="8" rx="1.5" />
      <rect x="2.5" y="12.5" width="6" height="5" rx="1.5" />
    </svg>
  ),
  orders: (
    <svg {...stroke}>
      <path d="M3.5 6.5h13l-1 10.500h-11z" />
      <path d="M7 6.500V5a3 3 0 016 0v1.500" />
    </svg>
  ),
  customers: (
    <svg {...stroke}>
      <circle cx="10" cy="6.500" r="3.800" />
      <path d="M2.500 18.500c1-4 4-5.500 7.500-5.500s6.500 1.500 7.500 5.500" />
    </svg>
  ),
  carts: (
    <svg {...stroke}>
      <path d="M2.500 3.500h2.500l2 9h8l1.500-6.500H6" />
      <circle cx="8" cy="16" r="1.200" />
      <circle cx="14.500" cy="16" r="1.200" />
    </svg>
  ),
  reviews: (
    <svg {...stroke}>
      <path d="M10 2.500l2.300 4.700 5.200.700-3.800 3.600.900 5.200L10 14.200l-4.600 2.500.900-5.200L2.500 7.900l5.200-.700z" />
    </svg>
  ),
  reports: (
    <svg {...stroke}>
      <path d="M3 17V9.500M8 17V4M13 17v-6M17.500 17V7" />
    </svg>
  ),
  account: (
    <svg {...stroke}>
      <circle cx="10" cy="10" r="7.500" />
      <circle cx="10" cy="8" r="2.500" />
      <path d="M5 15.500c1-2.300 2.900-3.200 5-3.200s4 .900 5 3.200" />
    </svg>
  ),
  messages: (
    <svg {...stroke}>
      <rect x="2" y="3.500" width="16" height="13" rx="3" />
      <path d="M3 5.500l7 5.500 7-5.500" />
    </svg>
  ),
  products: (
    <svg {...stroke}>
      <path d="M10 2l7 3.500v9L10 18l-7-3.500v-9z" />
      <path d="M3 5.500l7 3.500 7-3.500M10 9v9" />
    </svg>
  ),
  categories: (
    <svg {...stroke}>
      <path d="M2.500 5.500a2 2 0 012-2h3l2 2.500h6a2 2 0 012 2v6.500a2 2 0 01-2 2h-11a2 2 0 01-2-2z" />
    </svg>
  ),
  collections: (
    <svg {...stroke}>
      <path d="M10 2.500l7.500 4-7.500 4-7.500-4z" />
      <path d="M2.500 10l7.500 4 7.500-4M2.500 13.500l7.500 4 7.500-4" />
    </svg>
  ),
  discounts: (
    <svg {...stroke}>
      <path d="M15 5L5 15" />
      <circle cx="6" cy="6" r="2.200" />
      <circle cx="14" cy="14" r="2.200" />
    </svg>
  ),
  pages: (
    <svg {...stroke}>
      <path d="M5 2.500h6.500l3.500 3.500v11.500H5z" />
      <path d="M11.500 2.500V6H15M7.500 10h5M7.500 13.500h5" />
    </svg>
  ),
  layout: (
    <svg {...stroke}>
      <rect x="2.500" y="2.500" width="15" height="15" rx="3" />
      <path d="M2.500 7h15M7.500 7v10.500" />
    </svg>
  ),
  images: (
    <svg {...stroke}>
      <rect x="2.500" y="3.500" width="15" height="13" rx="3" />
      <circle cx="7" cy="8" r="1.500" />
      <path d="M3 14.500l4-4 3 3 3-4 4 5" />
    </svg>
  ),
  settings: (
    <svg {...stroke}>
      <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="8" cy="14" r="2" />
    </svg>
  ),
  external: (
    <svg {...stroke}>
      <path d="M8 4.500H4.500v11h11V12M11.500 3.500h5v5M16.500 3.500L9 11" />
    </svg>
  ),
  logout: (
    <svg {...stroke}>
      <path d="M8 3.500H4.500v13H8M12.500 6.500L16 10l-3.500 3.500M16 10H8" />
    </svg>
  ),
  collapse: (
    <svg {...stroke}>
      <rect x="2.500" y="3.500" width="15" height="13" rx="3" />
      <path d="M7.500 3.500v13M13 8l-2 2 2 2" />
    </svg>
  ),
};

// Skupljen meni postoji samo na širokom ekranu; na telefonu su stavke uvek sa nazivom.
const whenCollapsedHide = "md:group-data-[collapsed=true]/nav:hidden";
const item =
  "relative flex min-h-[44px] items-center gap-[12px] rounded-full px-[14px] font-display text-[15px] font-semibold transition-colors duration-300 md:group-data-[collapsed=true]/nav:justify-center md:group-data-[collapsed=true]/nav:px-0";
const quiet = "text-ink hover:bg-band hover:text-ink";

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean; badge?: number; area?: string };

type SidebarProps = {
  /** Koren panela (ADMIN_PATH). */
  base: string;
  name: string;
  /** Broj novih porudžbina, za oznaku u meniju. */
  waiting: number;
  /** Adresa sajta za kupce. */
  siteUrl: string;
  initialCollapsed: boolean;
  /** Ime prijavljenog korisnika, i delovi panela u koje njegova uloga sme. */
  user: string;
  areas: string[];
  logout: () => Promise<void>;
};

/** Bočni meni panela. Dugme u zaglavlju ga skuplja na same ikonice. */
export function Sidebar({ base, name, waiting, siteUrl, initialCollapsed, user, areas, logout }: SidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const all: { title?: string; items: NavItem[] }[] = [
    {
      items: [
        { href: base, label: "Pregled", icon: icons.overview, exact: true, area: "orders" },
        { href: `${base}/porudzbine`, label: "Porudžbine", icon: icons.orders, badge: waiting, area: "orders" },
        { href: `${base}/kupci`, label: "Kupci", icon: icons.customers, area: "orders" },
        { href: `${base}/korpe`, label: "Napuštene korpe", icon: icons.carts, area: "orders" },
        { href: `${base}/poruke`, label: "Poruke", icon: icons.messages, area: "orders" },
        { href: `${base}/utisci`, label: "Utisci", icon: icons.reviews, area: "orders" },
        { href: `${base}/izvestaji`, label: "Izveštaji", icon: icons.reports, area: "orders" },
      ],
    },
    {
      title: "Prodavnica",
      items: [
        { href: `${base}/proizvodi`, label: "Proizvodi", icon: icons.products, area: "catalog" },
        { href: `${base}/kategorije`, label: "Kategorije", icon: icons.categories, area: "catalog" },
        { href: `${base}/kolekcije`, label: "Kolekcije", icon: icons.collections, area: "catalog" },
        { href: `${base}/popusti`, label: "Popusti", icon: icons.discounts, area: "catalog" },
      ],
    },
    {
      title: "Sajt",
      items: [
        { href: `${base}/stranice`, label: "Stranice", icon: icons.pages, area: "content" },
        { href: `${base}/izgled`, label: "Izgled sajta", icon: icons.layout, area: "content" },
        { href: `${base}/slike`, label: "Slike", icon: icons.images, area: "content" },
      ],
    },
    {
      title: "Podešavanja",
      items: [
        { href: `${base}/podesavanja`, label: "Opšte", icon: icons.settings, area: "settings" },
        { href: `${base}/integracije`, label: "Integracije", icon: icons.layout, area: "settings" },
        { href: `${base}/korisnici`, label: "Korisnici", icon: icons.customers, area: "users" },
        { href: `${base}/dnevnik`, label: "Dnevnik", icon: icons.pages, area: "users" },
        { href: `${base}/nalog`, label: "Moj nalog", icon: icons.account },
      ],
    },
  ];
  const groups = all
    .map((group) => ({ ...group, items: group.items.filter((link) => !link.area || areas.includes(link.area)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      data-collapsed={collapsed}
      className="group/nav m-[12px] flex shrink-0 animate-fade flex-col rounded-[28px] bg-paper p-[12px] shadow-soft transition-[width] duration-500 ease-shop md:sticky md:top-[12px] md:mr-0 md:h-[calc(100vh-24px)] md:w-[256px] md:overflow-x-hidden md:overflow-y-auto md:data-[collapsed=true]:w-[72px]"
    >
      <div className="flex items-center justify-between gap-[8px] pt-[8px] pb-[12px] pl-[14px] md:group-data-[collapsed=true]/nav:justify-center md:group-data-[collapsed=true]/nav:pl-0">
        <div
          className={`flex min-w-0 items-center gap-[8px] font-display text-[22px] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap ${whenCollapsedHide}`}
        >
          <span className="size-[10px] shrink-0 rounded-full bg-gold" />
          <span className="truncate">{name}</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Proširi meni" : "Skupi meni"}
          title={collapsed ? "Proširi meni" : "Skupi meni"}
          className="flex size-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color,rotate] duration-500 ease-shop hover:bg-band max-md:hidden md:group-data-[collapsed=true]/nav:rotate-180"
        >
          {icons.collapse}
        </button>
      </div>

      <nav
        aria-label={t("Glavni meni")}
        className="flex flex-col gap-[2px] max-md:flex-row max-md:flex-wrap"
      >
        {groups.map((group) => (
          <div key={group.title ?? "top"} className="contents">
            {group.title && (
              <div className="eyebrow px-[14px] pt-[22px] pb-[8px] max-md:w-full md:group-data-[collapsed=true]/nav:justify-center md:group-data-[collapsed=true]/nav:px-0">
                <span className={whenCollapsedHide}>{group.title}</span>
              </div>
            )}
            {group.items.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  // Dok su nazivi skriveni, naziv stavke se vidi kad se pređe mišem.
                  title={collapsed ? link.label : undefined}
                  className={`${item} ${active ? "bg-ink text-paper hover:text-paper" : quiet}`}
                >
                  {link.icon}
                  <span className={`grow whitespace-nowrap ${whenCollapsedHide}`}>{link.label}</span>
                  {link.badge ? (
                    <>
                      <span
                        className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-gold px-[8px] text-[13px] font-bold text-ink ${whenCollapsedHide}`}
                      >
                        {link.badge}
                      </span>
                      <span className="absolute top-[7px] right-[9px] hidden size-[10px] rounded-full bg-gold ring-2 ring-paper md:group-data-[collapsed=true]/nav:block" />
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-[16px] flex flex-col gap-[2px] border-t border-line pt-[10px] max-md:flex-row md:mt-auto">
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          title={collapsed ? "Otvori sajt" : undefined}
          className={`${item} ${quiet}`}
        >
          {icons.external}
          <span className={`whitespace-nowrap ${whenCollapsedHide}`}>{t("Otvori sajt")}</span>
        </a>
        <form action={logout}>
          <button
            type="submit"
            title={collapsed ? "Odjavi se" : undefined}
            className={`${item} ${quiet} w-full cursor-pointer`}
          >
            {icons.logout}
            <span className={`truncate whitespace-nowrap ${whenCollapsedHide}`}>Odjavi se · {user}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
