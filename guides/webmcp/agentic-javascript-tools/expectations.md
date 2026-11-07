# Expectations

- Checks for modelContext in document before registering
- document.modelContext.registerTool is called with a tool definition object
- Tool definition includes name, description, inputSchema, and execute
- The inputSchema is a valid JSON Schema object with property descriptions
- An AbortController is created and its signal is passed to registerTool
- The execute function is asynchronous if it performs any async operations
