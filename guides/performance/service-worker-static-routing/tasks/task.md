---
base_app: daily-grind
---
- can you add a service worker to this coffee shop site? i want it to be efficient though, so make sure the /logout page and any calls to /api/telemetry/* bypass the worker completely. the browser should just fetch those from the network directly without even starting the worker thread.
- the site feels a bit slow because of the service worker intercepting everything. can you add some rules to skip interception for large files like .zip or .mp4 assets in the /assets/ folder? it would be better if the browser could evaluate these rules itself to skip the fetch event.
- can you make the service worker just ignore any requests to our analytics endpoint at api.stats-collector.com? i want it to go straight to the network and not wake up the worker process for those.
