---
name: data-integrity-auditing
description: Retain a pristine snapshot of incoming data for security audits and logging while performing destructive data transformations.
web-feature-ids:
  - structured-clone
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
---

# Pristine Data Snapshots for Security Audits

Using `structuredClone()` allows you to create a deep, decoupled copy of complex data structures before they are modified or destroyed by business logic. This ensures that security logs and audit trails reflect the exact state of incoming data, preserving nested objects, arrays, and special types like `Date`, `Map`, and `Set` that shallow copies or JSON-based cloning would lose or corrupt.

## How to implement

### Capture snapshots before transformation

MANDATORY: You must invoke `structuredClone()` on the raw input data immediately upon receipt, before any validation, sanitization, or transformation logic is applied.

```javascript
/**
 * Processes incoming user profile data.
 * @param {Object} incomingData - The raw data from the request.
 */
function processUserData(incomingData) {
  // MANDATORY: Create the snapshot immediately. 
  // This ensures the audit log records exactly what the user sent, 
  // even if 'incomingData' is later mutated or deleted.
  const auditSnapshot = structuredClone(incomingData);
  
  logToSecurityAudit(auditSnapshot);

  // Perform destructive transformations on the original reference
  transformData(incomingData);
}

function transformData(data) {
  // Destructive operation: deleting sensitive fields or reformatting
  delete data.rawMetadata;
  data.processedAt = new Date();
}
```

### Preserve complex data types

DO use `structuredClone()` over `JSON.parse(JSON.stringify())` when your data contains non-POJO (Plain Old JavaScript Object) types. `structuredClone` correctly preserves the identity and values of types that are common in modern data payloads but unsupported by JSON.

```javascript
const complexPayload = {
  receivedAt: new Date(),
  tags: new Set(['urgent', 'security']),
  metadata: new Map([['version', '1.0']]),
  buffer: new Uint8Array([1, 2, 3]).buffer
};

// DO NOT use JSON.stringify here; it would convert the Date to a string 
// and completely lose the Set, Map, and ArrayBuffer.
const pristineCopy = structuredClone(complexPayload);

// pristineCopy.receivedAt is still a Date object
// pristineCopy.tags is still a Set
```

### Transferable objects for performance (Optional)

If your incoming data includes large `ArrayBuffer` or `ImageBitmap` objects that you do not need to keep in the original reference, you can "transfer" them to the snapshot. This moves the memory instead of copying it, which is significantly faster for large binary payloads.

```javascript
function handleHeavyBinaryData(request) {
  // OPTIONAL: Using the 'transfer' option to move memory.
  // This is a performance optimization for very large binary data.
  const snapshot = structuredClone(request.data, {
    transfer: [request.data.largeBuffer]
  });

  // After transfer, request.data.largeBuffer is detached and unusable,
  // but snapshot.largeBuffer contains the original data.
  saveToLongTermStorage(snapshot);
}
```

## Fallback strategies

{{ BASELINE_STATUS("structured-clone") }}

If `structuredClone` is not available in the environment, you must implement a fallback that prevents the application from crashing while acknowledging potential data loss in the audit trail.

```javascript
/**
 * Safely clones data with a fallback for older environments.
 */
function safeClone(data) {
  // Feature detection using the global function
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }

  // FALLBACK: Manual deep clone or JSON approach
  try {
    // WARNING: JSON.parse/stringify is lossy (loses Map, Set, Date, etc.)
    // It should only be used as a last resort for audit logging.
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    // If the object has circular references, JSON.stringify will throw.
    // In this case, return a shallow copy to at least capture top-level keys.
    return { ...data, _auditError: 'Full deep clone failed' };
  }
}
```

For environments requiring full support for complex types without `structuredClone`, consider conditionally loading a polyfill. 

```javascript
// Example of conditional polyfill loading
if (typeof structuredClone !== 'function') {
  // Load a robust deep-clone utility only when needed
  // DO NOT load this unconditionally to save bandwidth
  import('./deep-clone-polyfill.js').then((module) => {
    window.structuredClone = module.default;
  });
}