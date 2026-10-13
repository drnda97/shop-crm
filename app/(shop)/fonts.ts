import {
  DM_Sans,
  Inter,
  Lora,
  Manrope,
  Montserrat,
  Playfair_Display,
  Poppins,
  Red_Hat_Display,
  Red_Hat_Text,
} from "next/font/google";

/**
 * Fontovi u ponudi (spisak: lib/theme.ts). next/font ih preuzima pri izradi sajta i služi sa
 * njegove adrese. Svaki dobija svoju CSS promenljivu (--font-inter…); pregledač preuzima samo
 * fontove koji su zaista upotrebljeni na stranici, pa se zato ne učitavaju unapred.
 */

// next/font čita opcije pri izradi sajta, pa su ispisane doslovno uz svaki font.
const redHatDisplay = Red_Hat_Display({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-red-hat-display" });
const redHatText = Red_Hat_Text({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-red-hat-text" });
const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-manrope" });
const montserrat = Montserrat({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-montserrat" });
const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], display: "swap", preload: false, variable: "--font-poppins" });
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-dm-sans" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-playfair-display" });
const lora = Lora({ subsets: ["latin", "latin-ext"], display: "swap", preload: false, variable: "--font-lora" });

/** Klase koje na <html> postavljaju promenljive svih fontova. */
export const fontVariables = [redHatDisplay, redHatText, inter, manrope, montserrat, poppins, dmSans, playfair, lora]
  .map((font) => font.variable)
  .join(" ");
