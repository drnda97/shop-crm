/** Liste koje čitaju i stranice (na serveru) i forme (u pregledaču), pa nisu u klijentskom modulu. */

export const FAQ_TOPICS = ["Sve", "Dostava", "Plaćanje", "Povrat", "Proizvodi"] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

export const CONTACT_TOPICS = [
  "Pitanje o proizvodu",
  "Uzorci tkanina",
  "Savet dizajnera",
  "Moja porudžbina",
  "Povrat ili reklamacija",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
