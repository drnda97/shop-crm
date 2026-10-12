/**
 * Poslovi po rasporedu, dok server radi: podsetnici za napuštene korpe (lib/abandoned.ts).
 * Na hostingu gde server ne radi stalno (serverless) isto pokreće poziv adrese
 * /api/v1/cron?key=CRON_SECRET iz rasporeda hostinga.
 */

const EVERY_MS = 10 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const state = globalThis as unknown as { shopcrmJobs?: boolean };
  if (state.shopcrmJobs) return;
  state.shopcrmJobs = true;

  const run = async () => {
    try {
      const { sendDueReminders } = await import("@/lib/abandoned");
      await sendDueReminders();
    } catch (error) {
      // Baza još nije dostupna ili nije podešena: sledeći pokušaj je za deset minuta.
      console.error(`[raspored] ${error instanceof Error ? error.message : error}`);
    }
  };
  // unref: raspored ne drži proces otvorenim pri gašenju servera.
  setInterval(run, EVERY_MS).unref();
}
