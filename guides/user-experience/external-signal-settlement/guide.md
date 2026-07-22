---
name: external-signal-settlement
description: Wait for a specific external signal or interaction to complete an asynchronous operation.
web-feature-ids:
  - promise-withresolvers
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
---

# Waiting for external signals with Promise.withResolvers()

`Promise.withResolvers()` provides a clean way to manage asynchronous operations that are completed by external triggers, such as user interactions, WebSocket messages, or event listeners. Unlike the standard `new Promise()` constructor, which requires the resolution logic to be defined inside its executor closure, `withResolvers()` exposes the `resolve` and `reject` functions directly. This allows you to create a promise in one part of your code and fulfill it from another, eliminating the need for complex variable hoisting or deeply nested callback structures.

## How to implement

### Instantiate the resolvers
Call `Promise.withResolvers()` to generate a promise object and its associated resolution and rejection functions.

```javascript
// Generate the promise and its resolvers
// This is typically done at the start of an operation that waits for a signal
const { promise, resolve, reject } = Promise.withResolvers();
```

### Bind resolvers to external events
Assign the `resolve` and `reject` functions to the event handlers that will signal the completion or failure of the operation.

```javascript
const modal = document.querySelector('#interaction-modal');
const confirmBtn = modal.querySelector('.confirm');
const cancelBtn = modal.querySelector('.cancel');

// Show the UI to the user
modal.classList.add('visible');

// Handle success
const onConfirm = () => {
  cleanup();
  // Fulfills the promise with a result object
  resolve({ status: 'confirmed', timestamp: Date.now() });
};

// Handle failure or cancellation
const onCancel = () => {
  cleanup();
  // MANDATORY: Always reject with an Error object to maintain useful stack traces
  reject(new Error('User cancelled interaction'));
};

function cleanup() {
  modal.classList.remove('visible');
  // MANDATORY: Explicitly remove listeners to prevent memory leaks from lingering closures
  confirmBtn.removeEventListener('click', onConfirm);
  cancelBtn.removeEventListener('click', onCancel);
}

// Attach listeners to trigger the resolution
confirmBtn.addEventListener('click', onConfirm, { once: true });
cancelBtn.addEventListener('click', onCancel, { once: true });
```

### Await the external signal
Use `await` to pause execution until the external event triggers the `resolve` or `reject` function.

```javascript
async function performActionWithConfirmation() {
  try {
    // Execution stays here until the user interacts with the modal
    const result = await promise;
    console.log('User completed interaction:', result);
    return result;
  } catch (error) {
    // Handles the rejection from the cancel button or other errors
    console.warn('Interaction failed:', error.message);
    throw error;
  }
}
```

### Handle synchronous setup errors
Because `Promise.withResolvers()` decouples the promise from its setup logic, any synchronous exceptions occurring during setup (before event listeners are bound) will not be automatically caught by the promise chain.

```javascript
function safeStartSignal() {
  const { promise, resolve, reject } = Promise.withResolvers();
  
  try {
    // DO: Wrap setup logic in try/catch to ensure errors are routed to the promise rejection
    performCriticalSetup(); 
    setupExternalListeners(resolve, reject);
  } catch (err) {
    // Manually route synchronous errors to the promise rejection
    reject(err);
  }
  
  return promise;
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("promise-withresolvers") }}

### Manual "Deferred" implementation
If the environment does not support `Promise.withResolvers()`, you can implement a polyfill that captures the resolvers from the standard constructor.

```javascript
// Feature detection for the static method
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Returns the exact same structure as the native method for transparency
    return { promise, resolve, reject };
  };
}
```

### Graceful degradation
In browsers without support and without a polyfill, calls to `Promise.withResolvers()` will throw a `TypeError`. For critical application paths, it is recommended to include the feature detection snippet above to ensure functionality in legacy environments. This feature is a progressive enhancement for developer ergonomics; the core asynchronous behavior remains identical to the traditional "deferred" pattern.