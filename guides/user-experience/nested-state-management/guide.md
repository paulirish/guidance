---
name: nested-state-management
description: Manage independent copies of complex, nested application data to ensure UI consistency and prevent accidental state mutations.
web-feature-ids:
  - structured-clone
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
---

# Managing nested application data with structuredClone()

Directly mutating shared state or using shallow copies (like the spread operator) in complex, nested applications often leads to difficult-to-track UI bugs and unintended side effects. `structuredClone()` is the recommended approach for deep cloning because it provides a native, performant, and robust way to create independent copies of objects, including those with circular references and complex types like `Map`, `Set`, and `Date`.

## How to implement

### Creating independent copies for state updates
When performing state transitions, you must ensure that nested objects are not shared between the old and new state. Shallow copies only clone the top-level properties, leaving nested objects as references to the original data.

```javascript
// Use structuredClone to create a deep copy before making modifications
// This prevents "stale" or accidental mutations of the previous state
// MANDATORY: Use this when the object has more than one level of nesting
const updatedData = structuredClone(currentAppData);

// Safely modify the clone; 'currentAppData' remains untouched
updatedData.nested.property = 'newValue';
```

### Preserving complex built-in types
Unlike `JSON.parse(JSON.stringify())`, `structuredClone()` correctly handles specialized JavaScript objects. Use this whenever your data contains non-POJO (Plain Old JavaScript Object) types to avoid data loss.

```javascript
const appState = {
  filters: new Set(['active', 'pending']),
  config: new Map([['timeout', 5000]]),
  lastUpdated: new Date()
};

// structuredClone preserves the instance types of Set, Map, and Date
// This ensures that methods like .has() or .get() still work on the clone
const stateClone = structuredClone(appState);

// stateClone.filters is still a Set instance
console.log(stateClone.filters.has('active')); // true
```

### Handling circular references
If your data model includes objects that reference each other in a loop (e.g., parent-child relationships), `structuredClone()` will handle them gracefully without throwing a recursion error.

```javascript
const nodeA = { id: 'A' };
const nodeB = { id: 'B' };
nodeA.child = nodeB;
nodeB.parent = nodeA; // Circular reference

// structuredClone detects the circle and recreates the graph structure correctly
// MANDATORY: Use this instead of JSON methods for graph-like data structures
const clonedGraph = structuredClone(nodeA);
```

## Fallback strategies

{{ BASELINE_STATUS("structured-clone") }}

For environments that do not support `structuredClone()`, you must implement a feature-detection check and provide a suitable alternative based on your data complexity.

### Feature detection and JSON fallback
For simple data structures consisting only of strings, numbers, booleans, arrays, and plain objects, `JSON.parse(JSON.stringify())` is a viable fallback.

```javascript
/**
 * MANDATORY: Check for structuredClone support before use.
 * HTMLElement.prototype check is not applicable here as it is a global method.
 */
function safeClone(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }

  // Fallback: This will lose Maps, Sets, and Dates, and throw on circular refs
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    // If JSON fails, the data is likely circular or contains non-serializable values
    // Return a shallow copy as a last resort, or use a dedicated utility library
    console.warn('Deep clone failed, falling back to shallow copy');
    return { ...data };
  }
}
```

### Conditional polyfilling
If your application relies heavily on deep cloning of complex types like `Map` or `Set`, you should conditionally load a polyfill rather than using a limited JSON fallback.

```javascript
// Detect missing support and load a polyfill if necessary
// OPTIONAL: Use dynamic imports to keep the initial bundle size small
if (!('structuredClone' in globalThis)) {
  // Load a polyfill conditionally (e.g., from a local vendor directory)
  // DO NOT load polyfills for all users; only those on unsupported browsers
}