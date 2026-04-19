---
name: timeout-event-listeners
description: Automatically deactivate a temporary event listener after a specific duration.
web-feature-ids:
  - abortsignal-timeout
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
---

# Automatically deactivate a temporary event listener after a duration

Using `AbortSignal.timeout()` allows you to define a specific lifespan for an event listener. This is ideal for transient UI states, such as a "click anywhere to close" behavior that should only exist for a few seconds, or short-lived interaction windows where you want to ensure the browser automatically cleans up the listener to prevent memory leaks and unexpected behavior.

## How to implement

### Generate a timeout signal
Create a signal that triggers an abort event automatically after a specified number of milliseconds.

```javascript
// Create a signal that aborts after 5000ms (5 seconds).
// 5000ms is a common duration for temporary interaction windows, 
// but this should be adjusted based on the specific UX requirement.
const autoAbortSignal = AbortSignal.timeout(5000);
```

### Apply the signal to an event listener
Pass the timeout signal into the `options` object of the `addEventListener` method. Once the timer expires, the browser will automatically remove the event listener.

```javascript
const menuElement = document.querySelector('.temporary-menu');

// The listener will only respond to clicks for the duration of the timeout signal.
document.addEventListener('click', (event) => {
  if (!menuElement.contains(event.target)) {
    menuElement.classList.remove('is-open');
  }
}, { 
  // MANDATORY: The 'signal' property links the listener lifecycle to the timeout.
  // Once autoAbortSignal aborts, this listener is removed automatically.
  signal: autoAbortSignal 
});
```

### Combining timeout with manual cancellation (Optional)
If you need the listener to be removed either after a timeout *or* when a specific action occurs (like a "Close" button being clicked), use `AbortSignal.any()` to merge multiple signals.

```javascript
const manualController = new AbortController();
const timeoutSignal = AbortSignal.timeout(10000);

// This listener is removed if the 10s timer hits OR if manualController.abort() is called.
const combinedSignal = AbortSignal.any([manualController.signal, timeoutSignal]);

window.addEventListener('keypress', handleShortTermInput, { signal: combinedSignal });
```

## Fallback strategies

{{ BASELINE_STATUS("abortsignal-timeout") }}

If `AbortSignal.timeout()` is not supported, you must manually manage an `AbortController` using a standard `setTimeout`.

### Feature detection and manual fallback
Check for the existence of the `timeout` method on `AbortSignal`. If missing, wrap an `AbortController` in a timer.

```javascript
/**
 * Helper to ensure timeout-based abortion works in older browsers.
 */
function getTimeoutSignal(ms) {
  if ('timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }

  // Fallback: Manually abort a controller after the delay
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

const fallbackSignal = getTimeoutSignal(5000);
document.addEventListener('mousemove', handleTrace, { signal: fallbackSignal });
```

### Progressive enhancement
If the event listener is not critical for the application to function (e.g., a non-essential tracking listener), you can simply check for support and only attach the listener if the `signal` option and `timeout` are supported. This avoids the overhead of manual cleanup in legacy environments.

```javascript
// Only attach the short-lived listener if the browser can clean it up automatically
if ('timeout' in AbortSignal) {
  document.addEventListener('click', temporaryHandler, { 
    signal: AbortSignal.timeout(3000) 
  });
}