---
name: url-routing-parameter-extraction
description: Route navigation requests and extract dynamic parameters to handle application logic across different JavaScript environments.
web-feature-ids:
  - urlpattern
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern
---

# Routing and Parameter Extraction with URLPattern

`URLPattern` provides a standardized, browser-native way to match URLs against patterns and extract dynamic segments. By using this API, you replace complex, error-prone regular expressions with a declarative syntax that is consistent across different JavaScript environments, including browsers, Service Workers, and server-side runtimes.

## How to implement

### Define patterns for dynamic routing

Create `URLPattern` instances to represent your application's routes. Patterns can include literal segments, named groups for dynamic parameters, and wildcards for flexible matching.

```javascript
// Define a pattern for a blog post with a dynamic slug and optional category
// The ':' prefix creates a named group, while '?' makes the segment optional
const postPattern = new URLPattern({
  pathname: '/blog/:category?/:slug',
});

// Patterns can also match hostnames, search parameters, or hashes
// This is useful for multi-tenant apps or specific query-based logic
const apiPattern = new URLPattern({
  hostname: ':subdomain.api.example.com',
  pathname: '/v1/*',
});
```

### Extract parameters from matches

Use the `exec()` method to test a URL against a pattern. If the URL matches, it returns an object containing the captured groups from different parts of the URL (pathname, search, hash, etc.).

```javascript
const currentUrl = 'https://example.com/blog/tech/url-pattern-api';
const match = postPattern.exec(currentUrl);

if (match) {
  // Access named groups from the pathname
  // match.pathname.groups contains { category: 'tech', slug: 'url-pattern-api' }
  const { category, slug } = match.pathname.groups;
  
  // Use extracted parameters to fetch data or update UI state
  console.log(`Loading ${slug} from ${category || 'default'} category`);
}
```

### Route requests in Service Workers

`URLPattern` is highly effective in Service Workers for routing `fetch` events. It allows you to declaratively intercept requests and apply specific caching or transformation logic.

```javascript
// MANDATORY: Use ES module syntax within your service worker
export const handleFetch = (event) => {
  const pattern = new URLPattern({ pathname: '/api/data/:id' });
  const match = pattern.exec(event.request.url);

  if (match) {
    // Intercept API calls to provide an offline-first experience
    // Extracting the ID ensures we can look up the specific resource in Cache Storage
    const id = match.pathname.groups.id;
    event.respondWith(handleApiRequest(id));
  }
};
```

## Fallback strategies

{{ BASELINE_STATUS("urlpattern") }}

### Feature detection and polyfilling

If the environment does not support `URLPattern`, you should detect the feature and conditionally load a polyfill. This ensures your routing logic remains functional in older browsers without bloating the bundle for modern ones.

```javascript
// MANDATORY: Check for URLPattern in the global scope to ensure cross-environment compatibility
if (!('URLPattern' in globalThis)) {
  // Use a dynamic import to load the polyfill only when needed
  // This prevents performance regressions for users on modern browsers
  await import('https://esm.sh/urlpattern-polyfill');
}

// Proceed with routing logic now that URLPattern is guaranteed to exist
const router = new URLPattern({ pathname: '/home' });
```

### Graceful degradation

If you choose not to polyfill, you must provide a fallback routing mechanism. This typically involves manual string parsing or simple `URL` object checks, though it will lack the sophisticated matching capabilities of `URLPattern`.

```javascript
function getRouteParams(urlStr) {
  if ('URLPattern' in globalThis) {
    const pattern = new URLPattern({ pathname: '/user/:id' });
    return pattern.exec(urlStr)?.pathname.groups;
  }

  // Fallback: Manual parsing for simple routes
  // This only handles the most basic case and is not as robust as the native API
  const url = new URL(urlStr);
  const parts = url.pathname.split('/');
  if (parts[1] === 'user' && parts[2]) {
    return { id: parts[2] };
  }
  
  return null;
}