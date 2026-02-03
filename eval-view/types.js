/**
 * @typedef {Object} Check
 * @property {string} id
 * @property {boolean} passed
 * @property {string} [message]
 */

/**
 * @typedef {Object} Run
 * @property {number} runNumber
 * @property {Check[]} results
 */

/**
 * @typedef {Object} EvalData
 * @property {Object} summary
 * @property {number} summary.unguidedMedian
 * @property {number} summary.guidedMedian
 * @property {number} [summary.unguidedPassRate]
 * @property {number} [summary.guidedPassRate]
 * @property {number} summary.numRuns
 * @property {Record<string, Run[]>} results
 * @property {Record<string, any>} [stats]
 */

/**
 * @typedef {Object} TestEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {number} runCount
 */

/**
 * @typedef {Object} Manifest
 * @property {TestEntry[]} tests
 */

/**
 * @typedef {Object} CachedTestData
 * @property {string} timestamp
 * @property {EvalData} data
 */

export {};
