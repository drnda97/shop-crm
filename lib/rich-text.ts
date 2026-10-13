/**
 * Tekst članka sa jednostavnim oznakama (podskup Markdown-a): prazan red razdvaja pasuse,
 * „## " je naslov, „### " podnaslov, „- " stavka spiska, „1. " numerisana stavka, „> " citat,
 * „![opis](/media/slika.jpg)" slika u svom redu; u tekstu **podebljano**, *iskošeno* i
 * [link](https://…). Pretvara se u stablo koje tema iscrtava, bez sirovog HTML-a.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "heading"; level: 2 | 3; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "quote"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "image"; src: string; alt: string };

/** Link sme da vodi na stranicu sajta, sidro, http(s), mailto ili tel; ostalo (javascript: …) se odbija. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (/^[/#](?!\/)/.test(value)) return value;
  return null;
}

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (match.index > 0) out.push({ kind: "text", text: rest.slice(0, match.index) });
    if (match[1] !== undefined) out.push({ kind: "bold", children: parseInline(match[1]) });
    else if (match[2] !== undefined) out.push({ kind: "italic", children: parseInline(match[2]) });
    else {
      const href = safeHref(match[4]);
      if (href) out.push({ kind: "link", href, children: parseInline(match[3]) });
      else out.push({ kind: "text", text: match[3] });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const BULLET = /^[-*]\s+/;
const NUMBER = /^\d+[.)]\s+/;

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const first = lines[0];
    const image = lines.length === 1 ? IMAGE_LINE.exec(first) : null;
    if (image) {
      // Slika sme biti samo sa ovog sajta ili sa https adrese.
      if (/^(\/(?!\/)|https:\/\/)/.test(image[2])) blocks.push({ kind: "image", src: image[2], alt: image[1] });
    } else if (first.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, children: parseInline(lines.join(" ").slice(4)) });
    } else if (first.startsWith("## ") || first.startsWith("# ")) {
      blocks.push({ kind: "heading", level: 2, children: parseInline(lines.join(" ").replace(/^#{1,2}\s+/, "")) });
    } else if (lines.every((line) => BULLET.test(line))) {
      blocks.push({ kind: "list", ordered: false, items: lines.map((line) => parseInline(line.replace(BULLET, ""))) });
    } else if (lines.every((line) => NUMBER.test(line))) {
      blocks.push({ kind: "list", ordered: true, items: lines.map((line) => parseInline(line.replace(NUMBER, ""))) });
    } else if (lines.every((line) => line.startsWith(">"))) {
      blocks.push({ kind: "quote", children: parseInline(lines.map((line) => line.replace(/^>\s*/, "")).join(" ")) });
    } else {
      blocks.push({ kind: "paragraph", children: parseInline(lines.join(" ")) });
    }
  }
  return blocks;
}

function inlineText(nodes: Inline[]): string {
  return nodes.map((node) => (node.kind === "text" ? node.text : inlineText(node.children))).join("");
}

/** Tekst bez oznaka, za kratak opis i pretraživače. */
export function plainText(source: string, max = 0): string {
  const text = parseRichText(source)
    .map((block) => (block.kind === "image" ? "" : block.kind === "list" ? block.items.map(inlineText).join(" ") : inlineText(block.children)))
    .filter(Boolean)
    .join(" ");
  if (max <= 0 || text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** Slike sa ovog sajta koje tekst koristi (/media/…). */
export function richTextImages(source: string): string[] {
  return parseRichText(source).flatMap((block) => (block.kind === "image" && block.src.startsWith("/media/") ? [block.src] : []));
}
