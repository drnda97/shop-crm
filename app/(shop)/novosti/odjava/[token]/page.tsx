import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { NewsletterUnsubscribePage } from "@theme/pages/simple";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Odjava od novosti"), robots: { index: false, follow: false } };
}

export default async function NewsletterUnsubscribeRoute({ params }: { params: Promise<{ token: string }> }) {
  return <NewsletterUnsubscribePage token={(await params).token} />;
}
