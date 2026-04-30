---
name: undo-redo-state-snapshots
description: Implement reliable undo and redo functionality by capturing point-in-time snapshots of complex application state.
web-feature-ids:
  - structured-clone
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
---

# Reliable Undo/Redo with State Snapshots

Implementing undo and redo functionality requires maintaining a history of an application's state. To ensure that a change to the current state does not inadvertently modify a previously saved state, you must capture a deep copy (a "snapshot") of the object. Using `structuredClone()` allows for high-performance deep cloning of complex state objects, including nested structures, `Date` objects, `Map` instances, and `Set` instances, without the limitations or performance overhead of serialization hacks.

## How to implement

### Initialize history management
To track snapshots, you must maintain two stacks: one for "undo" history and one for "redo" history.

```javascript
// Store snapshots of the state in arrays to act as stacks
const history = {
  undoStack: [],
  redoStack: [],
  // MANDATORY: Define a limit for history size to prevent memory exhaustion in long sessions
  maxHistory: 50 
};

let currentState = {
  text: "Initial state",
  metadata: new Date(),
  items: new Set(['item1'])
};
```

### Capture a state snapshot
Before performing an operation that modifies the state, capture the current state and push it onto the undo stack.

```javascript
function saveStep() {
  // MANDATORY: Use structuredClone to create a deep, immutable snapshot.
  // Shallow copies (like object spread) will fail if the state contains nested objects or collections.
  const snapshot = structuredClone(currentState);
  
  history.undoStack.push(snapshot);
  
  // OPTIONAL: Clear the redo stack whenever a new action is taken to maintain linear history
  history.redoStack = [];

  // Enforce history limits
  if (history.undoStack.length > history.maxHistory) {
    history.undoStack.shift();
  }
}
```

### Implement undo and redo logic
When restoring state, use `structuredClone()` again to ensure the restored state is itself a fresh copy, preventing accidental mutation of the history stack.

```javascript
function undo() {
  if (history.undoStack.length === 0) return;

  // Move current state to redo stack
  history.redoStack.push(structuredClone(currentState));

  // Pop the last snapshot and set it as current
  // MANDATORY: Re-clone on restoration to ensure 'currentState' remains independent of the history stack
  currentState = structuredClone(history.undoStack.pop());
  
  render(currentState);
}

function redo() {
  if (history.redoStack.length === 0) return;

  // Save current state to undo stack before moving forward
  history.undoStack.push(structuredClone(currentState));

  // Restore from redo stack
  currentState = structuredClone(history.redoStack.pop());

  render(currentState);
}
```

## Fallback strategies

{{ BASELINE_STATUS("structured-clone") }}

If `structuredClone` is not supported, you must detect the feature and provide a fallback. Note that common fallbacks like `JSON.parse(JSON.stringify(obj))` do not support circular references, `Date` objects (converted to strings), `Map`, `Set`, or `Blob`.

```javascript
function safeClone(obj) {
  // Feature detection for structuredClone
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }

  // Fallback for simple objects
  try {
    // WARNING: This fallback will lose Date objects, Maps, Sets, and undefined values.
    // Use a robust deep-clone library if your state contains complex types.
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    console.error("Deep clone failed: state may be too complex for JSON fallback", err);
    return Object.assign({}, obj); // Final fallback: shallow copy (dangerous for nested state)
  }
}
```

For applications with heavy use of `Map`, `Set`, or `Date` in their state, consider conditionally loading a `structuredClone` polyfill only when the native method is missing.

```javascript
// OPTIONAL: Conditionally load a polyfill for older environments
if (typeof structuredClone === 'undefined') {
  // Load polyfill script here
}