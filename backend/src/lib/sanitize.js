import sanitizeHtml from "sanitize-html";

export function sanitizeDescription(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a", "span", "div"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  }).trim();
}

export const plainText = (html) => sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
