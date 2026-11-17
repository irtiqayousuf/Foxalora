export type SafeEmailLink = {
  id: number;
  href: string;
  host: string;
  label: string;
  suspicious: boolean;
  reasons: string[];
};

export type SanitizedEmail = {
  html: string;
  text: string;
  links: SafeEmailLink[];
  remoteImages: string[];
  /** Number of unsafe elements or links that were removed. */
  removed: number;
};

const allowedTags = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CAPTION", "CODE", "DD", "DIV", "DL", "DT",
  "EM", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I", "IMG", "LI", "OL",
  "P", "PRE", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TABLE", "TBODY",
  "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL",
]);

const blockedTags = new Set([
  "AUDIO", "BASE", "BUTTON", "EMBED", "FORM", "FRAME", "FRAMESET", "IFRAME",
  "INPUT", "LINK", "MATH", "META", "NOSCRIPT", "OBJECT", "OPTION", "SCRIPT",
  "SELECT", "SOURCE", "STYLE", "SVG", "TEMPLATE", "TEXTAREA", "VIDEO",
]);

const voidTags = new Set(["BR", "HR", "IMG"]);
const blockTags = new Set(["BLOCKQUOTE", "DD", "DIV", "DL", "DT", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "OL", "P", "PRE", "TABLE", "TR", "UL"]);
const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);
}

function safeWebUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null;
    return url;
  } catch {
    return null;
  }
}

function linkWarnings(url: URL, label: string) {
  const host = url.hostname.toLowerCase();
  const bareHost = host.replace(/^www\./, "");
  const visibleHostCandidate = label.trim().match(/^(?:https?:\/\/)?([^/\s]+)/i)?.[1]?.toLowerCase().replace(/^www\./, "");
  const visibleHost = visibleHostCandidate?.includes(".") ? visibleHostCandidate : undefined;
  const reasons: string[] = [];
  if (visibleHost && visibleHost !== bareHost && !host.endsWith(`.${visibleHost}`)) reasons.push(`The text says “${visibleHost}” but the link goes to “${host}”.`);
  if (url.protocol !== "https:") reasons.push("The connection isn’t encrypted (http).");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) reasons.push("It points to a raw IP address instead of a website name.");
  if (host.includes("xn--")) reasons.push("The address uses look-alike characters.");
  return reasons;
}

/** Check a URL found in an email (HTML or plain text). Returns null for unsafe schemes. */
export function inspectLink(href: string, label: string, id = 0): SafeEmailLink | null {
  const url = safeWebUrl(href);
  if (!url) return null;
  const reasons = linkWarnings(url, label);
  return { id, href: url.href, host: url.hostname, label: label.trim().slice(0, 200) || url.hostname, suspicious: reasons.length > 0, reasons };
}

/** Local SVG stand-in for a blocked remote image: soft scene + caption, generated as a data URI. */
function placeholderImage(alt: string, width: number) {
  const height = Math.round(width * 0.5);
  const caption = (alt || "Image").slice(0, 60).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 560 280">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ecf4"/><stop offset="1" stop-color="#dfe3ee"/></linearGradient></defs>`
    + `<rect width="560" height="280" rx="18" fill="url(#g)"/>`
    + `<circle cx="430" cy="78" r="26" fill="#f4d58a"/>`
    + `<path d="M0 230 L140 120 L230 200 L330 110 L560 250 L560 280 L0 280 Z" fill="#c9cfdd"/>`
    + `<path d="M0 260 L180 170 L300 240 L420 180 L560 260 L560 280 L0 280 Z" fill="#b8bfd0"/>`
    + `<text x="24" y="40" font-family="Arial, sans-serif" font-size="15" fill="#6f7180">${caption}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

const inlineImagePattern = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

/**
 * Turn untrusted email HTML into a small allow-listed subset.
 * Scripts, forms, embeds, styles and event handlers are dropped. Only http(s) links survive,
 * rendered inert and listed separately. Remote images are blocked unless allowed, and
 * cid: inline images resolve only against the message's own attachments.
 */
export function sanitizeEmailHtml(source: string, allowRemoteImages: boolean, inlineImages: Record<string, string> = {}): SanitizedEmail {
  const parser = new DOMParser();
  const document = parser.parseFromString(source.slice(0, 200_000), "text/html");
  const links: SafeEmailLink[] = [];
  const remoteImages: string[] = [];
  let removed = 0;

  const render = (node: Node, depth = 0): { html: string; text: string } => {
    if (depth > 40) return { html: "", text: "" };

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return { html: escapeHtml(text), text };
    }

    if (!(node instanceof Element)) return { html: "", text: "" };

    const tag = node.tagName.toUpperCase();
    if (blockedTags.has(tag)) { if (!["META", "LINK", "STYLE", "BASE"].includes(tag)) removed++; return { html: "", text: "" }; }

    if (tag === "IMG") {
      const rawSource = node.getAttribute("src")?.trim() ?? "";
      const alt = node.getAttribute("alt")?.slice(0, 300) ?? "Email image";
      const width = Number(node.getAttribute("width"));
      const height = Number(node.getAttribute("height"));
      const dimensions = `${Number.isInteger(width) && width > 0 && width <= 1200 ? ` width="${width}"` : ""}${Number.isInteger(height) && height > 0 && height <= 1200 ? ` height="${height}"` : ""}`;
      if (/^cid:/i.test(rawSource)) {
        const inline = inlineImages[rawSource.slice(4).replace(/^<|>$/g, "")];
        if (inline && inlineImagePattern.test(inline) && inline.length <= 1_000_000) {
          return { html: `<img src="${escapeHtml(inline)}" alt="${escapeHtml(alt)}"${dimensions}>`, text: `[Image: ${alt}]` };
        }
        return { html: `<span class="blocked-image">[Missing image: ${escapeHtml(alt)}]</span>`, text: `[Image: ${alt}]` };
      }
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(rawSource) && rawSource.length <= 1_000_000) {
        return { html: `<img src="${escapeHtml(rawSource)}" alt="${escapeHtml(alt)}"${dimensions}>`, text: `[Image: ${alt}]` };
      }
      const remote = safeWebUrl(rawSource);
      if (remote) {
        if (!remoteImages.includes(remote.href)) remoteImages.push(remote.href);
        if (allowRemoteImages) return { html: `<img src="${escapeHtml(remote.href)}" alt="${escapeHtml(alt)}"${dimensions}>`, text: `[Image: ${alt}]` };
      }
      // Tiny images are almost always tracking pixels: drop them silently.
      if ((width > 0 && width <= 3) || (height > 0 && height <= 3)) return { html: "", text: "" };
      // Otherwise show a local placeholder picture (no network request) instead of the remote image.
      return { html: `<img class="placeholder-image" src="${placeholderImage(alt, Number.isInteger(width) && width > 0 ? Math.min(width, 640) : 560)}" alt="${escapeHtml(alt)}">`, text: `[Image: ${alt}]` };
    }

    const children = Array.from(node.childNodes).map((child) => render(child, depth + 1));
    const innerHtml = children.map((child) => child.html).join("");
    const innerText = children.map((child) => child.text).join("");

    if (tag === "A") {
      const link = inspectLink(node.getAttribute("href")?.trim() ?? "", node.textContent ?? "", links.length + 1);
      if (!link) { if (node.getAttribute("href")) removed++; return { html: `<span>${innerHtml}</span>`, text: innerText }; }
      const id = link.id;
      links.push(link);
      return {
        html: `<span class="email-link">${innerHtml}<sup>[${id}]</sup></span>`,
        text: `${innerText} [${id}]`,
      };
    }

    if (!allowedTags.has(tag)) return { html: innerHtml, text: innerText };

    const attributes: string[] = [];
    if (tag === "TD" || tag === "TH") {
      for (const name of ["colspan", "rowspan"]) {
        const value = Number(node.getAttribute(name));
        if (Number.isInteger(value) && value >= 1 && value <= 20) attributes.push(`${name}="${value}"`);
      }
      const align = node.getAttribute("align")?.toLowerCase();
      if (align && ["left", "right", "center"].includes(align)) attributes.push(`align="${align}"`);
    }
    if (tag === "IMG") {
      const alt = node.getAttribute("alt")?.slice(0, 300) ?? "Email image";
      attributes.push(`alt="${escapeHtml(alt)}"`);
    }

    const html = `<${tag.toLowerCase()}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${voidTags.has(tag) ? "" : `${innerHtml}</${tag.toLowerCase()}>`}`;
    const text = `${blockTags.has(tag) ? "\n" : ""}${tag === "LI" ? "• " : ""}${innerText}${blockTags.has(tag) ? "\n" : ""}`;
    return { html, text };
  };

  const rendered = Array.from(document.body.childNodes).map(render);
  return {
    html: rendered.map((part) => part.html).join(""),
    text: rendered.map((part) => part.text).join("").replace(/\n{3,}/g, "\n\n").trim(),
    links,
    remoteImages,
    removed,
  };
}


/* ---------------------------------------------------------------------------
   Outgoing mail: sanitize what the composer produces (or what was pasted in)
   into a small, email-client-friendly subset. Alignment becomes inline
   text-align styles; links keep only http(s)/mailto; images only inline data.
--------------------------------------------------------------------------- */

const outgoingTags = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "H1", "H2", "H3", "I", "IMG", "LI",
  "OL", "P", "S", "SPAN", "STRIKE", "STRONG", "U", "UL",
]);
const outgoingBlocks = new Set(["BLOCKQUOTE", "DIV", "H1", "H2", "H3", "LI", "OL", "P", "UL"]);

export function sanitizeOutgoingHtml(source: string): string {
  const doc = new DOMParser().parseFromString(source.slice(0, 2_000_000), "text/html");

  const render = (node: Node, depth = 0): string => {
    if (depth > 40) return "";
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toUpperCase();
    if (blockedTags.has(tag)) return "";
    const inner = Array.from(node.childNodes).map((child) => render(child, depth + 1)).join("");
    if (!outgoingTags.has(tag)) return inner;

    const attrs: string[] = [];
    if (tag === "A") {
      const href = node.getAttribute("href")?.trim() ?? "";
      const ok = /^mailto:[^\s"<>]+$/i.test(href) ? href : safeWebUrl(href)?.href;
      if (!ok) return inner;
      attrs.push(`href="${escapeHtml(ok)}"`, `target="_blank"`, `rel="noopener noreferrer"`);
    }
    if (tag === "IMG") {
      const src = node.getAttribute("src")?.trim() ?? "";
      if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src) || src.length > 8_000_000) return "";
      const alt = node.getAttribute("alt")?.slice(0, 200) ?? "";
      attrs.push(`src="${escapeHtml(src)}"`, `alt="${escapeHtml(alt)}"`, `style="max-width:100%;height:auto"`);
      return `<img ${attrs.join(" ")}>`;
    }
    if (outgoingBlocks.has(tag)) {
      const align = (node as HTMLElement).style?.textAlign || node.getAttribute("align") || "";
      if (["left", "center", "right", "justify"].includes(align)) attrs.push(`style="text-align:${align}"`);
    }
    if (tag === "BR") return "<br>";
    const name = tag === "STRIKE" ? "s" : tag.toLowerCase();
    return `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${inner}</${name}>`;
  };

  return Array.from(doc.body.childNodes).map((node) => render(node)).join("");
}

/** Readable plain-text version of composer HTML (for the text/plain part and plain mode). */
export function htmlToPlainText(source: string): string {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toUpperCase();
    if (tag === "BR") return "\n";
    if (tag === "IMG") return `[Image${node.getAttribute("alt") ? `: ${node.getAttribute("alt")}` : ""}]`;
    const inner = Array.from(node.childNodes).map(walk).join("");
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      return href && href !== inner ? `${inner} (${href})` : inner;
    }
    if (tag === "LI") return `• ${inner}\n`;
    if (outgoingBlocks.has(tag)) return `${inner}\n`;
    return inner;
  };
  return Array.from(doc.body.childNodes).map(walk).join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Escape plain text into simple paragraphs for the HTML editor. */
export function plainTextToHtml(text: string): string {
  return text.split(/\n{2,}/).map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Signatures were saved as plain text before; newer ones are HTML. Always hand back HTML. */
export function toSignatureHtml(signature: string): string {
  return /<[a-z][\s\S]*>/i.test(signature) ? signature : plainTextToHtml(signature);
}

/** True when a signature has visible text or an image (not just empty tags). */
export function signatureHasContent(html: string): boolean {
  return Boolean(htmlToPlainText(html).trim()) || /<img\b/i.test(html);
}
