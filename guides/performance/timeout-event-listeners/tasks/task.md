---
base_app: daily-grind
---
- hey, can you add a 'test-start-btn' to the seasonal favorites section? when i click it, i want it to activate a listener on a new button with id 'target' for exactly 5 seconds. clicking 'target' should alert 'captured'. make sure the listener is automatically deactivated by the browser after those 5 seconds are up without me needing to call removeEventListener.
- can you make a short-lived click handler for the espresso card? i want a 'trigger' button that makes the '.test-target-btn' active for like 4 seconds. use a built-in timeout mechanism to make sure the listener cleans itself up automatically.
- i need a transient interaction where clicking .test-start-btn starts a 6-second window for #target. it should alert 'active' when clicked during that time. use a signal that automatically expires after the duration to handle the event listener lifecycle.
