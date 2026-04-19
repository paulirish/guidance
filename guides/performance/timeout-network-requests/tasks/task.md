---
base_app: daily-grind
---
- can you update the seasonal favorites section to fetch its data from /api/seasonal instead of having it hardcoded? make sure the request times out if it takes more than 3 seconds so the site doesn't just hang.
- add a newsletter signup in the footer that sends a POST request to /api/subscribe. it should have a 5 second timeout on the network call.
- i want to show the user's loyalty points from /api/rewards in the navigation bar. make sure the fetch has a quick 2 second limit so it doesn't delay the page load if the server is slow.
- make sure all my network requests have some kind of timeout so they don't stay open forever if the connection is spotty.
