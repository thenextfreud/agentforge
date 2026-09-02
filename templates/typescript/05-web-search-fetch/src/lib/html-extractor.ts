/**
 * HTML text extraction utility.
 *
 * Fetches a URL and extracts readable text content by:
 * - Removing script, style, noscript, and other non-content tags
 * - Decoding HTML entities
 * - Preserving line breaks for block elements
 * - Truncating to a maximum content length
 */

/** Common HTML entities to decode. */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&laquo;": "«",
  "&raquo;": "»",
  "&ldquo;": "\u201C",
  "&rdquo;": "\u201D",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
  "&#x27;": "'",
};

function decodeHtmlEntities(text: string): string {
  let decoded = text;
  // Named entities
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.replaceAll(entity, replacement);
  }
  // Numeric entities: &#123; and &#x7B;
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return decoded;
}

/**
 * Extract readable text from an HTML string.
 *
 * Removes scripts, styles, and other non-content elements.
 * Preserves paragraph and line breaks for readability.
 *
 * @param html - raw HTML string
 * @param maxLength - maximum characters to return (default 50000)
 * @returns extracted plain text
 */
export function extractTextFromHtml(html: string, maxLength: number = 50000): string {
  let text = html;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove non-content tags entirely (script, style, noscript, template, svg, etc.)
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<template[\s\S]*?<\/template>/gi, "");
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");

  // Convert block-level closing tags to newlines for readability
  const blockTags = ["p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "hr"];
  for (const tag of blockTags) {
    const regex = new RegExp(`</?${tag}[^>]*>`, "gi");
    text = text.replace(regex, "\n");
  }

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")        // Collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n")     // Max 2 consecutive newlines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Truncate to max length
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + "\n... [truncated]";
  }

  return text.trim();
}

/**
 * Extract the page title from an HTML string.
 */
export function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return decodeHtmlEntities(match[1].trim());
}

/**
 * Extract meta description from an HTML string.
 */
export function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (!match) {
    // Try property="og:description"
    const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (!ogMatch) return null;
    return decodeHtmlEntities(ogMatch[1].trim());
  }
  return decodeHtmlEntities(match[1].trim());
}
