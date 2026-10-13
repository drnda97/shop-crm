import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Zaboravljena lozinka"), robots: { index: false, follow: false } };
}

export default function ForgotPasswordRoute() {
  return <ForgotPasswordPage />;
}
