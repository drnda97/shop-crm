import { notFound } from "next/navigation";

/** Adresa u panelu koja ne postoji: stranica 404 panela (admin/not-found.tsx), sa bočnim menijem. */
export default function UnknownAdminPage() {
  notFound();
}
