---
base_app: daily-grind
---
- hey, can you add a 'check order status' section to the page? i want a 'run' button that starts a fetch. it should have a 5 second timeout, and also a 'stop' button so the user can cancel it. if it times out, show a 'timed out' message. if the user cancels, show 'user cancelled'. make sure to use the modern ways to handle these combined signals without manual timer bookkeeping.
- can you build a feature to sync loyalty points? add a 'start' button to trigger the process. if it takes more than 4 seconds it should stop automatically and show a 'timed out' message. also include a 'cancel' button that shows 'user aborted' when clicked.
- i want a 'refresh menu' button that runs a background task. if it's too slow (like 5 seconds) it should show 'timed out'. let the user 'stop' it manually too and show 'user cancelled' if they do.
- add a 'check availability' button for the seasonal favorites. it should run a check that times out after 5 seconds. show 'timed out' if it hits the limit, or 'user stopped' if they hit a 'cancel' button.
