## Must pass
- Data transferred to the background worker preserves complex built-in types such as Map, Set, and Date.
- Circular references within the dataset are handled successfully without causing execution errors during the cloning process.
- The main thread remains responsive and capable of handling user input while the dataset is being processed by the background worker.
- Modifications made to the dataset within the background worker do not mutate the original data object in the main thread.

## Must fail
- The implementation uses `JSON.parse(JSON.stringify())` to clone data, leading to the loss of non-serializable types or failure on circular references.
- Heavy computation is performed on the main thread, causing detectable frame drops or UI freezing.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.