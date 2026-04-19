---
name: timeout-asynchronous-tasks
description: Cancel a complex asynchronous task when it exceeds a defined time budget.
web-feature-ids:
  - abortsignal-timeout
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
---

# Cancel a complex asynchronous task with a defined time budget

Modern web applications often perform long-running asynchronous operations, such as network requests or complex data processing, that should not run indefinitely. `AbortSignal.timeout()` provides a standardized way to define a "time budget" for these tasks, automatically triggering cancellation when the limit is reached. This prevents "hung" operations that waste system resources and degrade the user experience.

## How to implement

### Using a timeout with the Fetch API
The `fetch` API accepts an `AbortSignal` in its options object. When you provide a signal created via `AbortSignal.timeout()`, the browser automatically cancels the network request if it does not complete within the specified millisecond threshold.

```javascript
async function fetchWithBudget(url, limitMs) {
  try {
    // Create a signal that will automatically trigger after limitMs
    // This is cleaner than manual setTimeout/AbortController pairs.
    const signal = AbortSignal.timeout(limitMs);

    const response = await fetch(url, { 
      signal // The browser monitors this signal and cancels the request if it aborts
    });

    return await response.json();
  } catch (err) {
    // When a timeout occurs, the error name is specifically 'TimeoutError'
    if (err.name === 'TimeoutError') {
      console.error(`Request exceeded budget of ${limitMs}ms`);
    }
    throw err;
  }
}
```

### Combining timeout with user cancellation
In many scenarios, a task should be cancelled if it either hits a time limit OR if the user manually interrupts it (e.g., by clicking a "Cancel" button). You can use `AbortSignal.any()` to create a single signal that reacts to multiple abort sources.

```javascript
async function performTask(userSignal, timeLimit) {
  // Create the timeout signal for our time budget
  const timeoutSignal = AbortSignal.timeout(timeLimit);

  // Combine the user-controlled signal and the timeout signal.
  // The resulting signal aborts as soon as ANY of the input signals abort.
  const combinedSignal = AbortSignal.any([userSignal, timeoutSignal]);

  try {
    const result = await someAsyncWork({ signal: combinedSignal });
    return result;
  } catch (err) {
    // Distinguish between a budget timeout and a manual cancellation
    if (combinedSignal.aborted) {
      if (timeoutSignal.aborted) {
        console.log('Task stopped: Time budget exceeded.');
      } else {
        console.log('Task stopped: User cancelled.');
      }
    }
    throw err;
  }
}
```

### Passing signals to custom async functions
When writing your own asynchronous functions, always accept an `AbortSignal` and check its status or pass it down to underlying APIs like `fetch` or `indexedDB`.

```javascript
async function processData(data, { signal }) {
  for (const item of data) {
    // MANDATORY: Check if the signal has already been aborted before expensive steps
    if (signal.aborted) {
      // Throw the reason for abortion (usually a TimeoutError or AbortError)
      throw signal.reason;
    }
    
    await performHeavyCalculation(item);
  }
}
```

## Fallback strategies

### Fallback strategies
{{ BASELINE_STATUS("abortsignal-timeout") }}

For environments where `AbortSignal.timeout()` is not supported, you must manually manage an `AbortController` using `setTimeout`. 

```javascript
/**
 * Utility to get a timeout signal with feature detection.
 */
function getTimeoutSignal(ms) {
  // Check if the static 'timeout' method exists on the AbortSignal constructor
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }

  // Fallback: Manual AbortController + setTimeout
  const controller = new AbortController();
  const timer = setTimeout(() => {
    // We pass a TimeoutError to match the native AbortSignal.timeout behavior
    // This ensures error handling logic remains consistent across browsers.
    controller.abort(new DOMException('The operation timed out', 'TimeoutError'));
  }, ms);

  // Optional: Clean up the timer if the controller is aborted elsewhere
  // to avoid memory leaks or keeping the process alive.
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });

  return controller.signal;
}
```

If neither `AbortController` nor `AbortSignal.timeout()` are available (very old browsers), the operation cannot be cancelled mid-flight. In such cases, the fallback experience is typically to let the request run to completion but ignore its result once it finally arrives.