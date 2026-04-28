---
base_app: daily-grind
---
- implement a service worker that intercepts requests to `/api/products/:id` and returns a simple json response containing the id it extracted from the url.
- i want to handle all static assets in the `/static/` directory through the service worker using a wildcard pattern so we can manage them more efficiently.
- can you make the service worker recognize when a user is browsing a specific menu category at `/menu/:name` and extract that name from the path?
- i need the service worker to specifically intercept requests to `/api/orders/:id` but only if the id is a number, and just let it through if it's anything else.
