import type { Metadata } from "next";
import { ResetForm } from "../../../_components/account-extras";
import { SimplePage } from "../../../_components/simple-page";

export const metadata: Metadata = { title: "Nova lozinka", robots: { index: false, follow: false } };

/** Link iz emaila za novu lozinku; da li žeton važi proverava se pri čuvanju. */
export default async function NewPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <SimplePage title="Nova lozinka">
      <ResetForm token={token} />
    </SimplePage>
  );
}
