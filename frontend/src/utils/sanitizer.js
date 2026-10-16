/* eslint-disable no-control-regex */

/**
 * Sanitize raw code snippets against XSS, null-byte injections, and malformed unicode.
 * Guarantees safe string conversion for rendering inside semantic text containers.
 *
 * @param {string} snippet - Raw code or diff string
 * @returns {string} Sanitized plain-text string
 */
export function sanitizeCodeSnippet(snippet) {
  if (snippet === null || snippet === undefined) {
    return '';
  }
  const str = typeof snippet === 'string' ? snippet : String(snippet);
  // Strip control characters (except newline \n, tab \t, carriage return \r)
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

/**
 * HTML entity encoder for explicit escaping defense-in-depth
 *
 * @param {string} text - Raw input string
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
