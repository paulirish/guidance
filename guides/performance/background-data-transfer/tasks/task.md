---
base_app: daily-grind
---
- i want to add a "process history" button to the rewards page. when it's clicked, it should take a big object with the user's order dates and a map of their favorite drinks, then analyze it in the background so the page doesn't freeze. the data has some tricky circular references between orders, so make sure the background task can handle those correctly.
- can you add a "start trend analysis" button for the seasonal favorites? i want it to run in a background worker so the site stays snappy while it crunches the data, which includes a lot of dates and maps of customer preferences.
- on the locations page, add a "run search analysis" button that processes the store database in a background thread. the store objects have a lot of cross-references, so make sure the background task can handle those circular links without blocking the main thread.
