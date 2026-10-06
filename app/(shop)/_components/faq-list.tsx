"use client";

import { useState } from "react";
import { FAQ_TOPICS, type FaqTopic } from "./topics";

const QUESTIONS: { t: FaqTopic; q: string; a: string }[] = [
  { t: "Dostava", q: "Koliko traje isporuka?", a: "Nameštaj izrađujemo po porudžbini, pa isporuka traje 5 do 10 radnih dana. Termin dostave dogovaramo telefonom dan ranije." },
  { t: "Dostava", q: "Koliko košta dostava?", a: "Dostava sa unošenjem i montažom je besplatna za porudžbine preko 50.000 RSD. Za manje iznose cena je 1.200 RSD, bez obzira na broj komada." },
  { t: "Dostava", q: "Da li unosite i sastavljate nameštaj?", a: "Da. Naš tim unosi komade u stan, sastavlja ih i odnosi ambalažu. Napišite nam sprat i da li zgrada ima lift." },
  { t: "Plaćanje", q: "Koje načine plaćanja prihvatate?", a: "Platnu karticu (Visa, Mastercard, Dina), plaćanje pouzećem i uplatu na račun. Sve cene su u dinarima, sa uračunatim PDV-om." },
  { t: "Plaćanje", q: "Da li mogu da platim na rate?", a: "[Dopunite: banke, broj rata i uslovi plaćanja na rate.]" },
  { t: "Povrat", q: "Kako mogu da vratim proizvod?", a: "Proizvod možete vratiti u roku od 30 dana od isporuke, neoštećen. Pišite nam i poslaćemo tim po njega." },
  { t: "Povrat", q: "Kada dobijam novac nazad?", a: "Novac vraćamo u roku od 14 dana od preuzimanja vraćenog proizvoda, na isti način na koji je porudžbina plaćena." },
  { t: "Proizvodi", q: "Mogu li da dobijem uzorke tkanina?", a: "Da, šaljemo do pet besplatnih uzoraka tkanina i drveta na vašu adresu. Poručite ih preko kontakt forme." },
  { t: "Proizvodi", q: "Šta pokriva garancija?", a: "Pet godina garancije pokriva konstrukciju, spojeve i mehanizme. Rezervne delove za svaki model čuvamo deset godina." },
];

export function FaqList({ initialTopic }: { initialTopic: FaqTopic }) {
  const [topic, setTopic] = useState<FaqTopic>(initialTopic);
  const [open, setOpen] = useState(0);
  const list = QUESTIONS.filter((x) => topic === "Sve" || x.t === topic);

  return (
    <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 5vw, 88px)", alignItems: "flex-start" }}>
      <div className="sticky panel a2" style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "16px", padding: "22px" }}>
        <div className="lab">Teme</div>
        <div role="group" aria-label="Teme" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {FAQ_TOPICS.map((n) => (
            <button
              className={n === topic ? "chip on" : "chip"}
              onClick={() => {
                setTopic(n);
                setOpen(0);
              }}
              style={{ backgroundColor: n === topic ? "#0E2730" : "#FFFFFF" }}
              key={n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: "999 1 520px", minWidth: 0, borderTop: "1px solid rgba(14, 39, 48, .1)" }}>
        {list.map((x, i) => (
          <div className={i === open ? "acc open" : "acc"} key={x.q}>
            <button className="acc-h" aria-expanded={i === open} onClick={() => setOpen(i === open ? -1 : i)}>
              <span>{x.q}</span>
              <span className="plus"></span>
            </button>
            <div className="acc-b">
              <div>
                <p>{x.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
