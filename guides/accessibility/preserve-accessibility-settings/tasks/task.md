---
base_app: daily-grind
---
- the coffee cards in the grid look a bit too custom for some people. can you add a class called 'alt-theme' for the '.card' elements that resets their background and text color to the system defaults? i want to make sure we're honoring user-defined accessibility settings.
- the navigation links are missing a clear focus state. can you update them so that when focused, they just use the browser's default focus ring? it should basically just restore whatever the system usually does for outlines.
- make the footer links' font size more flexible. if the footer has a 'user-font' class, the links should just use the font size from the user's browser settings instead of our fixed size.
