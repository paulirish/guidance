---
name: subdomain-tenant-matching
description: Identify and route requests for specific tenants or environments by matching identifiers in hostnames and subdomains.
web-feature-ids:
  - urlpattern
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
  - https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern
---

# Routing and tenant identification using URLPattern

Multi-tenant applications often use subdomains or specific hostname structures to isolate environments and user data. URLPattern provides a standardized, declarative way to match these identifiers and extract them for routing logic, replacing manual string parsing and complex regular expressions.

## How to implement

### Defining patterns for subdomains and hostnames

To identify a tenant or environment, initialize a `URLPattern` object with a pattern specifically for the `hostname`. Use named groups (prefixed with `:`) to capture the variable parts of the domain.

```javascript
// Define a pattern that captures the first subdomain as the 'tenant'
const tenantPattern = new URLPattern({
  // Capture the tenant ID from the subdomain
  hostname: ':tenant.app.example.com',
  // Use a wildcard to match any path under this domain
  pathname: '/*',
});

// Example: Matching a staging environment with multiple subdomains
const envPattern = new URLPattern({
  // Capture both the environment and the tenant
  hostname: ':env-:tenant.example.com',
});
```

### Extracting and using identifiers

The `exec()` method returns a result object containing a `groups` property. This property holds the values captured by your named groups.

```javascript
const currentUrl = window.location.href;
const match = tenantPattern.exec(currentUrl);

if (match) {
  // Extract the named group 'tenant'
  const tenantId = match.hostname.groups.tenant;
  
  // MANDATORY: Always validate the extracted identifier before using it
  // to fetch data or modify the UI to prevent injection or routing errors.
  initializeTenantApp(tenantId);
}
```

### Handling multiple routing rules

When your application supports multiple identifier formats (e.g., custom domains vs. subdomains), use an array of patterns and iterate through them.

```javascript
const patterns = [
  // Subdomain pattern
  new URLPattern({ hostname: ':tenant.provider.com' }),
  // Custom domain pattern (where the whole hostname is the tenant identifier)
  new URLPattern({ hostname: ':tenantDomain' })
];

function getTenantInfo(url) {
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) {
      // Return the first match found
      return match.hostname.groups;
    }
  }
  return null;
}
```

## Fallback strategies

{{ BASELINE_STATUS("urlpattern") }}

### Feature detection and manual parsing

If `URLPattern` is not supported, you must fall back to manual URL parsing using the `URL` API and string manipulation or regular expressions.

```javascript
function getTenant(urlStr) {
  // MANDATORY: Check for URLPattern support before use
  if ('URLPattern' in globalThis) {
    const pattern = new URLPattern({ hostname: ':tenant.example.com' });
    return pattern.exec(urlStr)?.hostname.groups.tenant;
  }

  // Fallback: Use the standard URL API
  try {
    const url = new URL(urlStr);
    const parts = url.hostname.split('.');
    
    // Logic depends on your specific domain structure
    // Example: captures 'tenant' from 'tenant.example.com'
    if (parts.length >= 3) {
      return parts[0];
    }
  } catch (e) {
    return null;
  }
  
  return null;
}
```

### Conditional polyfilling

If your application relies heavily on complex URL matching that is difficult to replicate with manual parsing, you should conditionally load a polyfill.

```javascript
// OPTIONAL: Only load the polyfill if the browser lacks native support
if (!('URLPattern' in globalThis)) {
  // Use a dynamic import to avoid penalizing modern browsers
  await import('https://esm.sh/urlpattern-polyfill');
}

// After this check, URLPattern can be used normally
const pattern = new URLPattern({ hostname: ':id.example.com' });