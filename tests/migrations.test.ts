import type { Pool } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { pendingMigrations, runMigrations, type Migration } from "@/lib/migrations";

/** Zamena za bazu: pamti upisane migracije i redosled upita. */
function fakePool(applied: number[] = [], lockFree = true) {
  const log: string[] = [];
  const rows = applied.map((id) => ({ id }));
  const connection = {
    async query(sql: string, values?: unknown[]) {
      if (sql.includes("GET_LOCK")) return [[{ locked: lockFree ? 1 : 0 }]];
      if (sql.startsWith("SELECT id FROM schema_migrations")) return [rows];
      if (sql.startsWith("INSERT INTO schema_migrations")) {
        rows.push({ id: values?.[0] as number });
        log.push(`upis ${values?.[0]}`);
      }
      if (sql.includes("RELEASE_LOCK")) log.push("otključano");
      return [[]];
    },
    release() {
      log.push("vraćeno");
    },
  };
  const pool = { getConnection: async () => connection } as unknown as Pool;
  return { pool, log, ids: () => rows.map((row) => row.id) };
}

function migration(id: number, log: string[], fail = false): Migration {
  return {
    id,
    name: `m${id}`,
    up: async () => {
      if (fail) throw new Error("greška u migraciji");
      log.push(`izvršeno ${id}`);
    },
  };
}

describe("migracije baze", () => {
  it("izvršava samo one kojih nema, redom po broju", async () => {
    const db = fakePool([1]);
    await runMigrations(db.pool, [migration(3, db.log), migration(1, db.log), migration(2, db.log)]);
    expect(db.log).toEqual(["izvršeno 2", "upis 2", "izvršeno 3", "upis 3", "otključano", "vraćeno"]);
  });

  it("drugo pokretanje ne radi ništa", async () => {
    const db = fakePool();
    const list = [migration(1, db.log)];
    await runMigrations(db.pool, list);
    await runMigrations(db.pool, list);
    expect(db.log.filter((entry) => entry === "izvršeno 1")).toHaveLength(1);
  });

  it("posle greške staje: neuspela i sledeće nisu upisane, a veza je vraćena", async () => {
    const db = fakePool();
    const list = [migration(1, db.log), migration(2, db.log, true), migration(3, db.log)];
    await expect(runMigrations(db.pool, list)).rejects.toThrow("greška u migraciji");
    expect(db.ids()).toEqual([1]);
    expect(db.log.slice(-2)).toEqual(["otključano", "vraćeno"]);
  });

  it("ne radi dok drugi proces drži zaključavanje", async () => {
    const db = fakePool([], false);
    await expect(runMigrations(db.pool, [migration(1, db.log)])).rejects.toThrow("zauzete");
    expect(db.log).toEqual(["vraćeno"]);
  });

  it("odbija dva ista ili neispravna broja", () => {
    expect(() => pendingMigrations([migration(1, []), migration(1, [])], new Set())).toThrow("isti broj");
    expect(() => pendingMigrations([migration(0, [])], new Set())).toThrow("neispravan broj");
  });
});
