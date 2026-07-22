---
name: asynchronous-job-tracking
description: Coordinate a collection of asynchronous tasks that are settled by external components or workers.
web-feature-ids:
  - promise-withresolvers
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
---

# Coordinating asynchronous tasks settled by external components

`Promise.withResolvers()` provides a mechanism to create a promise along with its resolution functions (`resolve` and `reject`) as standalone variables. This pattern is essential for coordinating "deferred" tasks where the logic that starts an operation (e.g., sending a request to a Web Worker) is physically or logically separate from the event that completes it (e.g., receiving a message back). This approach avoids deep nesting and allows for more flexible, event-driven architectures.

## How to implement

### Extract the promise capability
Instead of wrapping your logic inside a standard `new Promise()` executor, use `Promise.withResolvers()` to extract the control functions into the current scope. This allows you to return the promise to the caller while retaining the ability to settle it from anywhere else in your code.

```javascript
/**
 * Create an object containing the promise and its resolvers.
 * These resolvers can be passed into event listeners or stored in a registry.
 */
const { promise, resolve, reject } = Promise.withResolvers();

// Return the promise to the consumer immediately
// while keeping 'resolve' and 'reject' for later use.
return promise;
```

### Manage concurrent tasks with a registry
When coordinating multiple asynchronous operations (e.g., jobs sent to a Web Worker), maintain a `Map` to associate task identifiers with their corresponding resolvers. This ensures that incoming responses are matched to the correct pending promise.

```javascript
class TaskCoordinator {
  #pendingTasks = new Map();

  dispatch(taskId, payload) {
    const { promise, resolve, reject } = Promise.withResolvers();
    
    // Store resolvers indexed by a unique ID (e.g., 'task-001')
    this.#pendingTasks.set(taskId, { resolve, reject });

    // Send the task to an external worker (example actor)
    worker.postMessage({ taskId, payload });

    return promise;
  }

  handleResponse(event) {
    const { taskId, result, error } = event.data;
    const task = this.#pendingTasks.get(taskId);

    if (!task) return;

    // MANDATORY: Settle the promise based on external feedback
    if (error) {
      task.reject(error);
    } else {
      task.resolve(result);
    }

    // MANDATORY: Clean up the registry to prevent memory leaks
    this.#pendingTasks.delete(taskId);
  }
}
```

### Handle synchronous errors manually
The standard `Promise` constructor automatically catches synchronous errors thrown within its executor and converts them into rejections. Because `Promise.withResolvers()` moves resolution logic outside of a constructor, you must wrap any code that precedes or performs resolution in a `try...catch` block to ensure consistent asynchronous error behavior.

```javascript
const { promise, resolve, reject } = Promise.withResolvers();

function processExternalData(data) {
  try {
    // MANDATORY: Manually catch errors that happen during processing
    const processed = transformData(data); 
    resolve(processed);
  } catch (err) {
    // Ensure the error is routed to the promise's .catch() handlers
    reject(err);
  }
}
```

### Prevent memory leaks in event listeners
If you attach `resolve` or `reject` to long-lived event listeners (like `AbortSignal` or global emitters), ensure they are cleaned up once the promise settles. Using the `once: true` option is the most reliable way to prevent the resolver from holding the promise in memory indefinitely.

```javascript
const { promise, resolve, reject } = Promise.withResolvers();

// DO: Use 'once' to automatically remove the listener after the first trigger
// This ensures the promise can be garbage collected after settling.
controller.signal.addEventListener('abort', () => {
  reject(new Error('Operation cancelled'));
}, { once: true });
```

## Fallback strategies

{{ FEATURE_FALLBACKS("promise-withresolvers") }}

If `Promise.withResolvers()` is not supported by your target environment, you can implement the "deferred" pattern manually by capturing the resolvers from the standard `Promise` constructor.

```javascript
/**
 * Feature detection for the static method.
 */
if (typeof Promise.withResolvers !== 'function') {
  // Graceful degradation using a manual implementation
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
```

This fallback ensures your application logic remains consistent. When using the manual capture method, you must be equally vigilant about manual error handling and memory management, as the captured `resolve` and `reject` functions behave identically to the native ones.