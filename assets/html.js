// @ts-check
/**
 * @fileoverview Auto-escaping `html` tagged template for the dashboard's client modules. Every
 * interpolated value is escaped unless it is a `SafeHtml` this code built itself (via `html` or
 * `raw`). Mirrors ui/html.ts on the server.
 */

/** @type {Readonly<Record<string, string>>} */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} value */
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

export class SafeHtml {
  /** @param {string} value */
  constructor(value) {
    this.value = value;
  }
}

/** Marks markup this code built itself as safe to insert. @param {string} value */
export const raw = (value) => new SafeHtml(value);

/** @param {unknown} value @returns {string} */
function part(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(part).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** @param {Element} el @param {SafeHtml} safe */
export function setHtml(el, safe) {
  el.innerHTML = safe.value;
}
