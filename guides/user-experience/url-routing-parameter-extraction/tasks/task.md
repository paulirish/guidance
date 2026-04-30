---
base_app: daily-grind
---
- i want to handle the coffee detail pages without a full reload. can you add logic to intercept clicks on the 'View Details' buttons, and when the url is something like /menu/espresso or /menu/cold-brew, grab that last part from the path and update the 'Seasonal Favorites' h2 to say 'Now Viewing: ' followed by the drink name?
- hey, can you set up some routing for the account links? i want to be able to handle urls like /account/orders or /account/settings and pull out that sub-page name from the url so i can use it to decide what to show the user.
- make it so the app knows which location someone is looking at when they go to a path like /locations/seattle-eastside. i need to be able to extract that location id from the address bar easily.
