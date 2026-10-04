import { redirect } from "next/navigation";
import { ADMIN_PATH } from "@/lib/admin-auth";

/** CRM nema javnu početnu stranu: sajt prodavnice je odvojen i čita podatke preko API-ja. */
export default function Home() {
  redirect(ADMIN_PATH);
}
