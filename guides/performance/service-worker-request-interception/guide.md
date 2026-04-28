---
name: service-worker-request-interception
description: Intercept and handle network requests in a service worker based on specific URL structures.
web-feature-ids:
  - urlpattern
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern
---

# Intercept and handle network requests in a service worker with URLPattern

Using the `URLPattern` API within a Service Worker allows you to replace complex regular expressions and manual string parsing with a standardized, readable syntax for matching request URLs. This approach simplifies routing logic by providing a built-in way to identify specific URL structures and extract dynamic parameters (like IDs or categories) directly from the path or query string.

## How to implement

### Define patterns outside the event listener
For optimal performance, initialize your `URLPattern` instances at the top level of your Service Worker script. This ensures the patterns are compiled only once when the worker starts, rather than being re-created for every network request.

```javascript
// Define patterns at the top level to avoid overhead during fetch events
// The object syntax is preferred for clarity and avoids ambiguity with base URLs
const PRODUCT_DETAIL_PATTERN = new URLPattern({
  pathname: '/api/products/:id',
});

const STATIC_ASSETS_PATTERN = new URLPattern({
  pathname: '/static/*',
});
```

### Match requests in the fetch event
Use the `test()` method for simple routing logic where you only need to know if a URL matches. This is the most efficient way to decide whether to intercept a request or let it fall through to the network.

```javascript
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Use .test() for fast boolean matching
  if (PRODUCT_DETAIL_PATTERN.test(url)) {
    event.respondWith(handleProductRequest(event));
  } else if (STATIC_ASSETS_PATTERN.test(url)) {
    event.respondWith(handleStaticAsset(event));
  }
  // If no match, the request proceeds to the network naturally
});
```

### Extract dynamic parameters
When you need to access specific parts of the URL (like a numeric ID), use the `exec()` method. It returns an object containing the matched groups defined in your pattern.

```javascript
async function handleProductRequest(event) {
  // .exec() returns null if no match, or a result object with 'pathname.groups'
  const match = PRODUCT_DETAIL_PATTERN.exec(event.request.url);
  
  if (match) {
    // Extract the ':id' parameter defined in the pattern
    const productId = match.pathname.groups.id;
    
    // Use the extracted ID to build a custom response or check a cache
    const cache = await caches.open('product-data');
    const cachedResponse = await cache.match(`/api/data/${productId}`);
    
    return cachedResponse || fetch(event.request);
  }
  
  return fetch(event.request);
}
```

### Use wildcard and group constraints
URLPattern supports powerful matching rules, including wildcards (`*`) and custom regular expressions within groups, allowing you to intercept broad categories of requests with a single pattern.

```javascript
// Match only numeric IDs using a custom regex group
const NUMERIC_API_PATTERN = new URLPattern({
  pathname: '/api/:category/:id(\\d+)',
});

// This pattern will match '/api/books/123' but NOT '/api/books/abc'
```

## Fallback strategies

{{ BASELINE_STATUS("urlpattern") }}

### Feature detection and manual routing
If `URLPattern` is not supported, you must provide a manual fallback using `URL` object properties, `startsWith()`, or `RegExp`. This ensures the Service Worker can still route requests in older browsers, albeit with more verbose code.

```javascript
// MANDATORY: Check if URLPattern is available in the global scope
if ('URLPattern' in globalThis) {
  const pattern = new URLPattern({ pathname: '/api/:id' });
  // Use URLPattern logic...
} else {
  // Fallback to manual string or regex matching
  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Manual path checking as a progressive enhancement fallback
    if (url.pathname.startsWith('/api/')) {
      const parts = url.pathname.split('/');
      const id = parts[2]; // Equivalent to :id
      
      if (id) {
        event.respondWith(handleProductRequestManual(id));
      }
    }
  });
}
```

### Conditional polyfilling
If your routing logic is too complex to maintain with manual fallbacks, you can conditionally load a polyfill. In a Service Worker, this is typically done via `importScripts()`.

```javascript
// Only load the polyfill if the browser lacks native support
if (!('URLPattern' in globalThis)) {
  // DO NOT load polyfills unconditionally to avoid unnecessary byte transfers
  importScripts('https://cdn.jsdelivr.net/npm/urlpattern-polyfill@latest/dist/index.js');
}