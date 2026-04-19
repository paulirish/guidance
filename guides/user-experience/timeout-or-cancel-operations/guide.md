---
name: timeout-or-cancel-operations
description: Cancel an ongoing operation when either a user-initiated abort occurs or a maximum time limit is reached.
web-feature-ids:
  - abortsignal-timeout
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
---

# Combining User Abort with Timeouts using AbortSignal.timeout()

To ensure robust network operations and long-running tasks, implementations should be cancellable both by explicit user action (e.g., clicking a "Cancel" button) and by an automatic safety timeout. Using `AbortSignal.timeout()` in conjunction with `AbortSignal.any()` provides a declarative way to manage multiple abort sources without the complexity of manual `setTimeout` bookkeeping or leaked timer references.

## How to implement

### Create the primary AbortController
The `AbortController` serves as the source for user-initiated cancellation. You must retain access to the controller instance to call `.abort()` when the user interacts with the UI.

### Initialize the timeout signal
Use `AbortSignal.timeout(ms)` to create a signal that transitions to the aborted state automatically after the specified number of milliseconds. This signal does not require manual cleanup, as the browser manages the internal timer.

### Merge signals with AbortSignal.any()
To allow an operation to be cancelled by either the user or the timeout, use `AbortSignal.any()`. This method accepts an array of signals and returns a single combined signal that aborts as soon as any of its input signals abort.

```javascript
// Example: Fetching data with both a user 'Cancel' button and a 5-second timeout
async function fetchWithTimeout(url, userController) {
  const timeoutMs = 5000; // 5 seconds is a standard default for mobile-friendly requests

  // Create a signal that aborts automatically after 5000ms
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  try {
    // MANDATORY: Combine the user-controlled signal and the timeout signal.
    // The fetch will abort if EITHER the user clicks cancel OR the timeout is reached.
    const combinedSignal = AbortSignal.any([
      userController.signal, 
      timeoutSignal
    ]);

    const response = await fetch(url, { signal: combinedSignal });
    return await response.json();
  } catch (error) {
    // MANDATORY: Check the error name to provide specific feedback.
    // 'TimeoutError' is thrown specifically by AbortSignal.timeout().
    if (error.name === 'TimeoutError') {
      console.error('Request timed out automatically.');
    } 
    // 'AbortError' is the standard result of calling controller.abort().
    else if (error.name === 'AbortError') {
      console.log('User cancelled the operation.');
    } else {
      throw error;
    }
  }
}
```

### Handle specific abort reasons
When an operation is aborted via `AbortSignal.any()`, the resulting error in the `catch` block will reflect the reason of the first signal that aborted. 
- If the timeout wins: The error name will be `"TimeoutError"`.
- If the user wins: The error name will be `"AbortError"`.

## Fallback strategies

{{ BASELINE_STATUS("abortsignal-timeout") }}

If `AbortSignal.timeout()` is not supported, you must manually implement the timeout using `setTimeout`. If `AbortSignal.any()` is also unsupported, you must manually wire the timeout to the user's `AbortController`.

### Feature Detection and Polyfill
Check for the existence of `timeout` on the `AbortSignal` constructor.

```javascript
function getCombinedSignal(userController, ms) {
  // Check if the modern API is available
  if ('timeout' in AbortSignal && 'any' in AbortSignal) {
    return AbortSignal.any([userController.signal, AbortSignal.timeout(ms)]);
  }

  // Fallback: Manually trigger the user controller after a delay
  const timeoutId = setTimeout(() => {
    // We manually abort the user controller, meaning the error 
    // will always be 'AbortError' in the fallback case.
    userController.abort();
  }, ms);

  // Ensure the timer is cleared if the user cancels manually first
  userController.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });

  return userController.signal;
}
```

### Graceful Degradation
In environments where `AbortController` itself is missing, the application should allow the request to proceed without cancellation capabilities. Ensure that your UI (e.g., the "Cancel" button) is hidden or disabled if the browser does not support `window.AbortController`.