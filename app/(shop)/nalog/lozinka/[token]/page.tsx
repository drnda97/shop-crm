import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { NewPasswordPage } from "@theme/pages/simple";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Nova lozinka"), robots: { index: false, follow: false } };
}

/** Link iz emaila za novu lozinku; da li žeton važi proverava se pri čuvanju. */
export default async function NewPasswordRoute({ params }: { params: Promise<{ token: string }> }) {
  return <NewPasswordPage token={(await params).token} />;
}
