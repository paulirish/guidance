---
base_app: daily-grind
---
- add a feature where clicking any 'view details' button fetches data from `/api/coffee-info`. the request should have a 3 second time budget—if it takes longer than that, just stop and show an error message so the user knows what happened.
- can you make the 'order now' button check if we're still taking orders at `/api/status`? it shouldn't wait more than 2 seconds for the server to respond.
- i want to make sure the rewards page doesn't just hang while loading. implement a fetch for `/api/rewards` that cancels itself if it takes more than 5 seconds.
- make the app more responsive by ensuring our network requests don't stay open forever on slow connections.
