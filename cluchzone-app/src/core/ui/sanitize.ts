// ═══════════════════════════════════════════════════════════
// CLUCHZONE — XSS Sanitization
// MUST be used for ALL user-generated content in innerHTML
// ═══════════════════════════════════════════════════════════

/**
 * Sanitizes a string for safe insertion via innerHTML.
 * Prevents XSS attacks from user-controlled data.
 * 
 * Usage: el.innerHTML = sanitize`Team: ${teamName}`
 */
export function sanitize(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    return result + escapeHtml(String(val ?? '')) + str;
  });
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Safe alternative to innerHTML for plain text content.
 * Use this when you just need to display text, not HTML.
 */
export function setText(element: HTMLElement | null, text: string): void {
  if (element) element.textContent = text;
}

/**
 * Safely set innerHTML with validated HTML (no user input).
 * Only use for developer-controlled template strings.
 */
export function setHTML(element: HTMLElement | null, html: string): void {
  if (element) element.innerHTML = html;
}
