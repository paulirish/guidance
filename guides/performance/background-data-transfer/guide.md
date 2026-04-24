---
name: background-data-transfer
description: Coordinate the transfer of large datasets to background workers for heavy computation without blocking the user interface.
web-feature-ids:
  - structured-clone
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
---

# Offload Dataset Processing with structuredClone()

Processing large or complex datasets on the main thread can cause significant frame drops and an unresponsive user interface. While Web Workers allow for background execution, ensuring that the worker receives a clean, independent snapshot of the UI state is critical. The `structuredClone()` method provides a native way to create deep copies of complex objects—including those with circular references, `Map`, `Set`, and `Date` objects—ensuring the main thread can continue modifying its state without causing race conditions or data corruption in the background worker.

## How to implement

### Snapshotting complex state for Worker offloading
To keep the UI thread responsive, you must ensure that data sent to a background worker is a decoupled copy. This prevents the worker from accidentally observing mutations made by the UI thread while the background task is running.

```javascript
// Example state containing complex types not supported by JSON.stringify
const appState = {
  id: crypto.randomUUID(),
  lastUpdate: new Date(),
  dataset: new Float32Array(1000000), // Large numeric data
  metadata: new Map([['source', 'sensor-a']])
};

function processData() {
  // MANDATORY: Clone the state before sending to the worker to prevent 
  // the UI thread from mutating data that the worker is currently reading.
  const dataSnapshot = structuredClone(appState);

  // The worker now has a complete, independent copy of the state
  // including the Date object and Map, which are preserved.
  worker.postMessage(dataSnapshot);
}
```

### Optimizing performance with Transferables
For exceptionally large datasets, such as `ArrayBuffer` or `ImageBitmap`, cloning can still be expensive in terms of memory. You can use the `transfer` option within `structuredClone()` to move specific heavy objects to the clone without copying them, effectively "handing over" the memory.

```javascript
const largeDataset = {
  header: "High-res Scan",
  buffer: new ArrayBuffer(1024 * 1024 * 100) // 100MB buffer
};

// MANDATORY: Use the transfer option for large buffers to achieve 
// zero-copy performance. The original buffer will become unusable 
// in the calling thread, freeing up main-thread memory immediately.
const clonedData = structuredClone(largeDataset, { 
  transfer: [largeDataset.buffer] 
});

// largeDataset.buffer.byteLength is now 0 on the main thread
worker.postMessage(clonedData);
```

### Handling circular references
Unlike legacy methods like `JSON.parse(JSON.stringify())`, `structuredClone()` correctly handles objects that reference themselves. Use this when your data models represent complex graphs or linked lists.

```javascript
const nodeA = { name: "Node A" };
const nodeB = { name: "Node B" };
nodeA.link = nodeB;
nodeB.link = nodeA; // Circular reference

// MANDATORY: Use structuredClone when data structures have 
// circularities to avoid "Maximum call stack size exceeded" errors.
const safeClone = structuredClone(nodeA);
```

## Fallback strategies

{{ BASELINE_STATUS("structured-clone") }}

If `structuredClone()` is not available, you must determine if your data structure contains complex types (like `Map` or circular references) that require a robust deep-clone polyfill or if a simpler fallback is sufficient.

1.  **Feature Detection**: Check for the existence of the function on the global object.
2.  **JSON Fallback**: For simple, tree-like objects consisting of strings, numbers, and arrays, use the `JSON` object. Note that this will lose `Date`, `Map`, `Set`, and `Blob` types.
3.  **Manual Deep Clone**: For specific known structures, implement a manual recursive copy function.

```javascript
function deepClone(obj) {
  // Check if the native API is available
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }

  // OPTIONAL: Fallback for browsers without structuredClone.
  // WARNING: This will fail on circular references and 
  // will convert Dates to strings and drop Maps/Sets.
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error("Deep clone failed: Structure too complex for JSON fallback.");
    return obj; // Return original as a last resort (risk of mutation)
  }
}