---
name: timeout-network-requests
description: Enforce a maximum duration for a network request to prevent it from hanging indefinitely.
web-feature-ids:
  - abortsignal-timeout
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
---

# Enforce network request timeouts with AbortSignal.timeout()

Providing a maximum duration for network requests prevents them from hanging indefinitely due to poor connectivity or server-side issues, ensuring resources are released and the user interface remains responsive. `AbortSignal.timeout()` provides a native, declarative way to handle these timeouts without manual timer management.

## How to implement

### Create and pass the timeout signal
The `AbortSignal.timeout()` static method returns an `AbortSignal` object that will automatically trigger an abort event after a specified number of milliseconds.

```javascript
// Define a timeout duration based on your application's SLA.
// 5000ms is generally sufficient for standard API calls on mobile networks.
const REQUEST_TIMEOUT_MS = 5000;

try {
  // MANDATORY: Pass the signal directly to the fetch options.
  // This signal will automatically cancel the request if it exceeds the limit.
  const response = await fetch('https://api.example.com/data', {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const data = await response.json();
  console.log('Request succeeded:', data);
} catch (error) {
  // Handle the timeout specific error
  handleRequestError(error);
}
```

### Distinguish timeout errors from other failures
When a request is aborted via `AbortSignal.timeout()`, the `fetch` promise rejects with a `DOMException` named `TimeoutError`. It is important to distinguish this from a manual abort (which throws an `AbortError`) or a generic network failure.

```javascript
function handleRequestError(error) {
  if (error.name === 'TimeoutError') {
    // DO: Provide specific feedback if the request took too long.
    console.error('The request timed out. Please check your connection.');
  } else if (error.name === 'AbortError') {
    // This occurs if a separate AbortController was triggered by the user.
    console.log('The request was cancelled by the user.');
  } else {
    // This covers network errors like DNS failures or TLS handshake issues.
    console.error('A network error occurred:', error.message);
  }
}
```

### Combine with manual aborts (Optional)
If you need to support both a timeout and a user-initiated "Cancel" button, you can use `AbortSignal.any()` to combine multiple signals into one.

```javascript
const userController = new AbortController();
const timeoutSignal = AbortSignal.timeout(5000);

// Combine signals: the fetch will abort if EITHER the timeout hits OR the user clicks cancel.
const combinedSignal = AbortSignal.any([
  userController.signal,
  timeoutSignal
]);

try {
  await fetch('/api/data', { signal: combinedSignal });
} catch (error) {
  // Check which signal triggered the abort
  if (timeoutSignal.aborted) {
    console.error('Timed out');
  } else if (userController.signal.aborted) {
    console.log('User cancelled');
  }
}
```

## Fallback strategies

{{ BASELINE_STATUS("abortsignal-timeout") }}

If `AbortSignal.timeout` is not supported, you must manually manage a `setTimeout` and an `AbortController`. This ensures the request is still terminated and the browser can reclaim memory.

### Feature detection and manual implementation
Verify support by checking for the `timeout` method on the `AbortSignal` constructor.

```javascript
/**
 * A wrapper to ensure timeout support across all browsers.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  // Feature detection: check if the static method exists
  if ('timeout' in AbortSignal) {
    options.signal = AbortSignal.timeout(timeoutMs);
    return fetch(url, options);
  }

  // Fallback: Manual timer and controller
  const controller = new AbortController();
  const timer = setTimeout(() => {
    // Manually trigger the abort if the timer fires before completion
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    // MANDATORY: Always clear the timer to prevent memory leaks if the request finishes early
    clearTimeout(timer);
  }
}
```

### Fallback error handling
Note that manual aborts via `controller.abort()` typically throw an `AbortError` rather than a `TimeoutError`. When using the fallback, your error handling logic should treat an `AbortError` as a timeout if your code was the one that triggered the controller.