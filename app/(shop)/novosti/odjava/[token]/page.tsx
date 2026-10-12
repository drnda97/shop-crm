import type { Metadata } from "next";
import { NewsletterUnsubscribe } from "../../../_components/account-extras";
import { SimplePage } from "../../../_components/simple-page";

export const metadata: Metadata = { title: "Odjava od novosti", robots: { index: false, follow: false } };

export default async function NewsletterUnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <SimplePage title="Novosti">
      <NewsletterUnsubscribe token={token} />
    </SimplePage>
  );
}
