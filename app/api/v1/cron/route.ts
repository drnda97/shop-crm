import { createHash, timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/abandoned";

/**
 * Poslovi po rasporedu za hosting na kom server ne radi stalno: raspored hostinga poziva
 * /api/v1/cron?key=… (CRON_SECRET iz okruženja) na svakih desetak minuta.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (secret === "" || !timingSafeEqual(digest(key), digest(secret))) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ reminders: await sendDueReminders() });
}
