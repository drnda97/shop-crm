"use client";

import { useState, useTransition, type FormEvent } from "react";
import { subscribeAction } from "../actions";

type State = { kind: "idle" } | { kind: "error"; message: string } | { kind: "done"; code: string | null };

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await subscribeAction(email);
      if (!result.ok) return setState({ kind: "error", message: result.error });
      setEmail("");
      setState({ kind: "done", code: result.code });
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "480px" }}>
      <label htmlFor="nl-email" style={{ fontFamily: "var(--display)", fontSize: "15px", fontWeight: 600 }}>
        Email adresa
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 6px 6px 24px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, .1)",
          boxShadow: "inset 0 0 0 1.5px rgba(255, 255, 255, .22)",
        }}
      >
        <input
          id="nl-email"
          type="email"
          placeholder="ime@primer.rs"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setState({ kind: "idle" });
          }}
          style={{ flex: 1, minWidth: 0, height: "48px", background: "none", border: 0, outline: 0, color: "#FFFFFF", font: "500 16px var(--sans)" }}
        />
        <button className="btn gold" type="submit" disabled={pending} style={{ minHeight: "48px", padding: "0 24px" }}>
          Prijavi me
        </button>
      </div>
      <span role="status" style={{ fontSize: "14px", color: state.kind === "idle" ? "#B9C6C9" : "#F3C766" }}>
        {state.kind === "idle" && "Bez spama. Odjava jednim klikom."}
        {state.kind === "error" && state.message}
        {state.kind === "done" &&
          (state.code ? (
            <>
              Prijavljeni ste. Kod za 10% popusta na prvu porudžbinu: <strong>{state.code}</strong>
            </>
          ) : (
            "Prijavljeni ste."
          ))}
      </span>
    </form>
  );
}
