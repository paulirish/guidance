---
base_app: daily-grind
---
- add a 'custom order' section at the bottom of the main container with id 'custom-order-area'. it should have a nested object for 'activeOrder' containing 'drinkName', an 'options' object (for milk and syrup), and a 'timestamp' Date. add a 'clone for later' button that creates an independent copy of this order and shows it in a div with id 'saved-order-preview'. make sure editing the active order after cloning doesn't change the saved preview.
- can you implement a 'loyalty profile' editor? i want to store user preferences like 'favoriteStores' in a Set and 'notificationTimes' in a Map. add a 'test settings' feature that clones the whole profile so i can see how it looks in the UI without actually mutating the main state until i hit save.
- build a simple cart system for the seasonal favorites. each item in the cart should be a nested object with its own customizations. i need a 'duplicate item' button for each cart entry that creates a fresh copy so i can change the milk on one without it affecting the other.
- i want to add a 'session log' that tracks which drinks the user clicks on. it should store a list of objects, each with a 'visitDate' and 'details'. add a button to 'backup' the log to a local variable; make sure the backup is a deep copy so it doesn't keep growing when the user clicks more drinks.
