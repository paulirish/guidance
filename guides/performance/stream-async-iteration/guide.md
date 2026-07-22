---
name: stream-async-iteration
description: Transform event-based data streams into asynchronous iterables for sequential processing.
web-feature-ids:
  - promise-withresolvers
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
---

# Transform event-based streams into async iterables with `Promise.withResolvers()`

Converting event-driven data sources into asynchronous iterables allows you to process streams using the `for await...of` syntax. This pattern provides a linear, readable way to handle sequential data without deeply nested callbacks or complex state management. `Promise.withResolvers()` simplifies this by providing external control over a promise's lifecycle, which is essential for bridging the gap between push-based "push" events and pull-based "pull" iterators.

## How to implement

### Creating the bridge
To turn a stream into an async iterable, you need a mechanism to wait for the next "chunk" of data. Use `Promise.withResolvers()` to create a promise that represents the next available value and expose its resolution functions to the event listeners.

```javascript
/**
 * Converts an event-based stream into an AsyncIterable.
 * @param {EventEmitter} eventSource - The source emitting 'data', 'end', and 'error' events.
 */
export function streamToAsyncIterable(eventSource) {
  // MANDATORY: Initialize the first resolver set to wait for the first incoming event.
  let { promise, resolve, reject } = Promise.withResolvers();
  let isDone = false;

  eventSource.on('data', (data) => {
    // 1. Capture the resolve function for the currently pending 'next()' call.
    const currentResolve = resolve;
    
    // 2. DO: Immediately create a NEW promise/resolver set for the NEXT chunk.
    // This ensures the next iteration of the loop has a pending promise to wait on.
    ({ promise, resolve, reject } = Promise.withResolvers());
    
    // 3. Resolve the previous promise with the received data.
    currentResolve({ value: data, done: false });
  });

  // Handle stream termination
  eventSource.on('end', () => {
    isDone = true;
    // Resolve the final pending promise to signal the end of the iteration.
    resolve({ value: undefined, done: true });
  });

  // MANDATORY: Ensure errors are propagated to the async iterator to prevent silent failures.
  eventSource.on('error', (err) => {
    reject(err);
  });

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      // If the stream ended (e.g., 'end' event fired), return the terminal state.
      if (isDone) return { value: undefined, done: true };
      
      // Return the current promise which will be settled by the 'data' or 'error' events.
      return promise;
    }
  };
}
```

### Sequential processing
Once the iterable is created, you can consume it. This ensures that each chunk is fully processed (including any asynchronous work) before the next chunk is pulled from the stream.

```javascript
import { streamToAsyncIterable } from './stream-utils.js';

async function processAnalyticsStream(rawStream) {
  const iterable = streamToAsyncIterable(rawStream);

  try {
    // The 'for await' loop handles backpressure naturally by awaiting the loop body.
    for await (const chunk of iterable) {
      // Processing is sequential: we wait for this database write before the next chunk.
      await saveChunkToDatabase(chunk); 
    }
  } catch (error) {
    // Errors emitted via the 'error' event in the bridge will emerge here.
    console.error('Stream processing failed:', error);
  }
}
```

### Error and Memory Management
`Promise.withResolvers()` removes the implicit error catching provided by the traditional `new Promise((res, rej) => ...)` executor.

*   **DO** wrap your event handling logic in `try...catch` if the data transformation before calling `resolve()` might throw.
*   **MANDATORY**: If the stream can be aborted or destroyed from the outside, ensure you remove the event listeners or call `reject()` on the current pending promise to prevent the iterator from hanging indefinitely.

## Fallback strategies

{{ FEATURE_FALLBACKS("promise-withresolvers") }}

### Manual Deferred Pattern
In environments where `Promise.withResolvers()` is not yet available, you can manually implement the "deferred" pattern. This involves declaring variables in a parent scope and capturing the resolvers from inside a standard `Promise` constructor.

```javascript
// Feature detection and conditional polyfill
if (!Promise.withResolvers) {
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
```

### Graceful Degradation for Older Browsers
If the environment lacks support for `AsyncIterable` (e.g., legacy browsers), the feature cannot be progressively enhanced into a `for await` loop. In these cases, fallback to standard event listeners. Note that this loses the sequential processing guarantee unless you manually manage a task queue.

```javascript
function processStreamLegacy(source, processor) {
  if (typeof Symbol.asyncIterator === 'undefined') {
    // Fallback: Parallel processing via standard events
    source.on('data', (data) => {
      processor(data).catch(err => console.error('Processing error:', err));
    });
  } else {
    // Use the modern async iterable bridge
    consume(streamToAsyncIterable(source));
  }
}