import { getPanelT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ADMIN_PATH, getCurrentAdmin, needsSetup, roleCan } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { countNewOrders } from "@/lib/order-store";
import { logout } from "./actions";
import { AuthFrame } from "./auth-frame";
import { LoginForm } from "./login-form";
import { SetupForm } from "./setup-form";
import { Sidebar } from "./nav";
import { NAV_COOKIE } from "./nav-cookie";

export const metadata: Metadata = {
  title: "Admin panel",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Bez prijave se umesto bilo koje stranice panela prikazuje samo forma za prijavu.
  // Svaka stranica i akcija uz to sama proverava prijavu (requireAdmin).
  const user = await getCurrentAdmin();
  if (!user) {
    const [t, settings, setup] = await Promise.all([getPanelT(), getSettings(), needsSetup()]);
    return (
      <AuthFrame
        name={settings.store.name}
        hint={
          setup
            ? t("Prvo pokretanje: napravite nalog vlasnika. Ostale korisnike dodajete kasnije u panelu.")
            : t("Prijavite se da biste upravljali prodavnicom.")
        }
      >
        {setup ? <SetupForm /> : <LoginForm />}
      </AuthFrame>
    );
  }

  const [settings, waiting] = await Promise.all([getSettings(), countNewOrders()]);
  const { name, storefrontUrl } = settings.store;

  // Da li je meni skupljen pamti se u kolačiću, pa se stranica odmah iscrta u tom obliku.
  const collapsed = (await cookies()).get(NAV_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-screen flex-col bg-band md:flex-row">
      {/* Bez upisane adrese sajta link vodi na prodavnicu koja ide uz panel, na istoj adresi. */}
      <Sidebar
        base={ADMIN_PATH}
        name={name}
        waiting={waiting}
        siteUrl={storefrontUrl || "/"}
        initialCollapsed={collapsed}
        user={user.name || user.username}
        // Stavke menija za delove panela u koje uloga ne sme se ne prikazuju.
        areas={(["orders", "catalog", "content", "settings", "users"] as const).filter((area) => roleCan(user.role, area))}
        logout={logout}
      />

      <main className="min-w-0 grow px-[20px] py-[28px] md:px-[40px] md:py-[40px]">
        <div className="enter">{children}</div>
      </main>
    </div>
  );
}
