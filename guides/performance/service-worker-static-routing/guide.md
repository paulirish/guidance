---
name: service-worker-static-routing
description: Optimize resource loading by bypassing service worker execution for specific resource paths.
web-feature-ids:
  - urlpattern
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern
---

# Bypassing service worker execution for specific resource paths

Service workers can introduce overhead by intercepting every request, which adds latency due to worker startup time and message passing. For resources that do not require offline support or custom caching logic—such as telemetry, large binary assets, or real-time streaming data—bypassing the service worker entirely is a significant performance optimization. Using `URLPattern` in conjunction with the Service Worker Static Routing API allows the browser to evaluate routing rules declaratively and skip service worker execution for matching paths.

## How to implement

### Registering declarative routes with URLPattern
To bypass service worker execution, you must register your routing rules during the `install` event. This allows the browser to identify and handle these requests on the main thread, avoiding the need to wake up the service worker thread at all.

```javascript
self.addEventListener('install', (event) => {
  // Verify that the Static Routing API is supported by the browser
  if (event.registerRouter) {
    event.registerRouter([
      {
        // Define which requests should bypass the service worker
        condition: {
          // Use URLPattern syntax to match specific paths or file types
          // The '*' wildcard allows for broad matching within a directory
          urlPattern: "/api/telemetry/*",
        },
        // 'network' source instructs the browser to fetch directly from the network
        source: "network",
      },
      {
        condition: {
          // Use curly braces for expansion to match multiple file extensions
          urlPattern: "/assets/*.{zip,mp4,dmg}",
        },
        source: "network",
      }
    ]);
  }
});
```

### Using URLPattern objects for complex conditions
For more complex scenarios involving specific hostnames or query parameters, you can pass a pre-configured `URLPattern` object to the routing condition.

```javascript
// Define a pattern for a specific CDN and versioned assets
const cdnPattern = new URLPattern({
  hostname: "cdn.example.com",
  pathname: "/v2/static/*",
  search: "v=*", // Matches requests with a version query parameter
});

self.addEventListener('install', (event) => {
  if (event.registerRouter) {
    event.registerRouter([
      {
        condition: {
          urlPattern: cdnPattern, // Directly use the compiled pattern object
        },
        source: "network",
      }
    ]);
  }
});
```

### Efficient logic-based bypassing in the fetch event
If the declarative Routing API is unavailable, you can still use `URLPattern` within the `fetch` event to quickly determine if a request should be ignored. While this does not prevent the service worker from starting, it minimizes the processing time within the worker.

```javascript
// Pre-compile patterns outside the listener to avoid repetitive construction
const bypassList = [
  new URLPattern({ pathname: '/health-check' }),
  new URLPattern({ pathname: '/logs' })
];

self.addEventListener('fetch', (event) => {
  // Use .test() for a high-performance boolean check
  const isBypassPath = bypassList.some(pattern => pattern.test(event.request.url));

  if (isBypassPath) {
    // Returning early without calling event.respondWith() 
    // signals the browser to handle the request normally.
    return;
  }

  // ... rest of the service worker caching/interception logic ...
});
```

## Fallback strategies
{{ BASELINE_STATUS("urlpattern") }}

When `URLPattern` or the declarative routing API is not supported, the browser will continue to intercept all requests through the standard `fetch` event. The application will remain functional, but it will not benefit from the reduced latency of bypassing the service worker.

MANDATORY: You must check for both `URLPattern` and the `registerRouter` method to ensure the optimization is only applied where supported.

```javascript
// Check for the presence of the required APIs
const supportsStaticRouting = 'registerRouter' in InstallEvent.prototype;
const supportsURLPattern = 'URLPattern' in self;

if (supportsStaticRouting && supportsURLPattern) {
  // Apply declarative routing optimizations
} else {
  // Fall back to standard service worker interception
  // Optionally use RegExp or string matching in the fetch event
}
```

If `URLPattern` is missing, do not attempt to polyfill it inside the service worker unless absolutely necessary, as the polyfill itself may add more latency than the optimization saves. Instead, rely on simple string methods like `request.url.startsWith()` for basic path filtering in the `fetch` event as a low-overhead fallback.