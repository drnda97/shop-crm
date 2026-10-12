import type { Metadata } from "next";
import { ResetRequestForm } from "../../_components/account-extras";
import { SimplePage } from "../../_components/simple-page";

export const metadata: Metadata = { title: "Zaboravljena lozinka", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <SimplePage title="Zaboravljena lozinka">
      <p className="lead">Upišite email adresu naloga. Poslaćemo vam link na kom postavljate novu lozinku.</p>
      <ResetRequestForm />
    </SimplePage>
  );
}
