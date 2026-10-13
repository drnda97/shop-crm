"use client";

import { useT } from "@/lib/i18n/client";
import { useState, useTransition, type FormEvent } from "react";
import { contactAction, type ContactErrors } from "@/app/(shop)/actions";
import { ERROR_STYLE, Field } from "./field";
import { ArrowIcon } from "./ui";

export function ContactForm({ topics, initialTopic }: { topics: string[]; initialTopic: string }) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(initialTopic);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await contactAction({ name, email, topic, text });
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setText("");
      setSent(true);
    });
  }

  return (
    <form
      className="panel a2"
      onSubmit={submit}
      noValidate
      style={{
        flex: "999 1 480px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        background: "var(--paper)",
        boxShadow: "inset 0 0 0 1.5px var(--line)",
      }}
    >
      <h2 className="display h-m">{t("Pošaljite poruku")}</h2>
      <div className="fgrid">
        <Field id="k-name" label={t("Ime i prezime")} type="text" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: undefined }); }} error={errors.name} />
        <Field id="k-email" label={t("Email adresa")} type="email" autoComplete="email" placeholder={t("ime@primer.rs")} value={email} onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }); }} error={errors.email} />
      </div>
      <div className="f">
        <label htmlFor="k-topic">{t("Tema")}</label>
        <select id="k-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map((item) => (
            <option key={item} value={item}>{t(item)}</option>
          ))}
        </select>
      </div>
      <div className="f">
        <label htmlFor="k-msg">{t("Poruka")}</label>
        <textarea
          id="k-msg"
          placeholder={t("Kako možemo da pomognemo?")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrors({ ...errors, text: undefined });
            setSent(false);
          }}
        ></textarea>
        {errors.text && (
          <span role="alert" style={ERROR_STYLE}>
            {t(errors.text)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 20px" }}>
        <button className="btn" type="submit" disabled={pending}>
          {t("Pošalji poruku")}
          <i><ArrowIcon /></i>
        </button>
        {sent && (
          <span role="status" style={{ fontSize: "15px", fontWeight: 600 }}>
            {t("Hvala, poruka je poslata. Odgovaramo u roku od jednog radnog dana.")}
          </span>
        )}
      </div>
    </form>
  );
}
