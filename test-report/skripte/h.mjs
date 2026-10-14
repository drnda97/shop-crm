// Pomoćne funkcije za testove: pozivi server akcija i API-ja na probnom serveru (127.0.0.1:3100).
import { readFileSync, appendFileSync } from "node:fs";
import mysql from "../app/node_modules/mysql2/promise.js";

export const BASE = "http://127.0.0.1:3100";
const dir = new URL("..", import.meta.url).pathname;
export const ACTIONS = JSON.parse(readFileSync(`${dir}actions.json`, "utf8"));
const env = Object.fromEntries(
  readFileSync(`${dir}app/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (env.DB_NAME !== "shopcrm_test") throw new Error("Pogrešna baza!");
export const db = await mysql.createPool({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, timezone: "Z", connectionLimit: 3 });
export const q = async (sql, params = []) => (await db.query(sql, params))[0];

let ipCounter = 0;
const RUN = 1 + Math.floor(Math.random() * 250);
/** Sesija: kolačići + adresa (X-Forwarded-For), da brojači pokušaja ne mešaju testove. */
export class Session {
  constructor(ip) {
    this.cookies = new Map();
    this.ip = ip ?? `10.${RUN}.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  async fetch(path, init = {}) {
    const headers = { ...(this.ip ? { "x-forwarded-for": this.ip } : {}), ...(init.headers ?? {}) };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    const response = await fetch(path.startsWith("http") ? path : BASE + path, { redirect: "manual", ...init, headers });
    this.store(response);
    return response;
  }
  async get(path, init) {
    const response = await this.fetch(path, init);
    return { status: response.status, headers: response.headers, text: await response.text(), location: response.headers.get("location") };
  }
  /** Poziv server akcije. args: niz običnih vrednosti, ili { form: {..}, prev?: bool } za FormData. */
  async act(name, args = [], { path = "/", origin = BASE, raw = false } = {}) {
    const id = ACTIONS[name] ?? ACTIONS[`actions:${name}`] ?? ACTIONS[`user-actions:${name}`] ?? ACTIONS[`blog-actions:${name}`];
    if (!id) throw new Error(`Nema akcije ${name}`);
    const headers = { "next-action": id, accept: "text/x-component", ...(origin ? { origin } : {}) };
    let body;
    if (!Array.isArray(args)) {
      body = new FormData();
      for (const [key, value] of Object.entries(args.form ?? {})) {
        for (const one of Array.isArray(value) ? value : [value]) {
          if (one instanceof Blob) body.append(`_1_${key}`, one, one.name ?? "file");
          else body.append(`_1_${key}`, String(one));
        }
      }
      // Koren ide poslednji, kao što šalje pregledač: polja forme moraju stići pre njega.
      body.append("0", JSON.stringify(args.prev ? [{}, "$K1"] : ["$K1"]));
    } else {
      headers["content-type"] = "text/plain;charset=UTF-8";
      body = JSON.stringify(args);
    }
    const response = await this.fetch(path, { method: "POST", headers, body });
    const text = await response.text();
    if (raw) return { status: response.status, text, headers: response.headers };
    const redirect = response.headers.get("x-action-redirect");
    let value;
    for (const line of text.split("\n")) {
      const match = /^1:(.*)$/.exec(line);
      if (match) {
        try { value = JSON.parse(match[1]); } catch { value = match[1]; }
      }
    }
    const error = /^\d+:E(\{.*\})$/m.exec(text)?.[1];
    return { status: response.status, value, redirect: redirect ? decodeURIComponent(redirect.replace(/;.*$/, "")) : null, error: error ?? null, text };
  }
  async api(path, { method = "GET", body, headers = {} } = {}) {
    const response = await this.fetch(`/api/v1${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: response.status, json, text, headers: response.headers };
  }
}

/* ---------- beleženje ishoda ---------- */
const results = [];
const LOG = `${dir}results.jsonl`;
let area = "";
export function section(name) { area = name; console.log(`\n## ${name}`); }
/** kind: "pos" | "neg" | "sec". pass: true/false; detail: šta je viđeno. */
export function check(kind, title, pass, detail = "") {
  const row = { area, kind, title, pass: !!pass, detail: typeof detail === "string" ? detail : JSON.stringify(detail) };
  results.push(row);
  appendFileSync(LOG, JSON.stringify(row) + "\n");
  console.log(`${pass ? "  ok  " : "  FAIL"} [${kind}] ${title}${pass && !detail ? "" : ` — ${row.detail.slice(0, 400)}`}`);
  return !!pass;
}
export function note(text) { console.log(`  ..   ${text}`); }
export function done() {
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length} provera, ${failed} palo`);
  return db.end();
}
export const short = (value, n = 300) => (typeof value === "string" ? value : JSON.stringify(value) ?? "undefined").slice(0, n);
