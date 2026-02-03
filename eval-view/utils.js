/** @template {string} T @typedef {import('typed-query-selector/parser.js').ParseSelector<T, HTMLElement>} ParseSelector */

/**
 * Guaranteed context.querySelector. Always returns an element or throws if nothing matches query.
 * @template {string} T
 * @param {T} query
 * @param {ParentNode=} context
 * @return {ParseSelector<T>}
 */
export function $(query, context) {
  const result = (context || document).querySelector(query);
  if (result === null) {
    throw new Error(`query ${query} not found`);
  }
  return /** @type {any} */ (result);
}

/**
 * context.querySelectorAll. Returns a typed NodeList.
 * @template {string} T
 * @param {T} query
 * @param {ParentNode=} context
 * @return {NodeListOf<ParseSelector<T>>}
 */
export function $$(query, context) {
  return /** @type {any} */ ((context || document).querySelectorAll(query));
}
