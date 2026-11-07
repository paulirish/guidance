* The implementation uses `window.Summarizer` and does not use the deprecated `window.ai.summarizer` API surface.
* The implementation calls `Summarizer.availability()` to check model availability before creating the summarizer.
* The same options are passed to both `Summarizer.availability()` and `Summarizer.create()`.
* The `Summarizer` instance's `summarize()` or `summarizeStreaming()` method is called to generate a summary.
* A monitor for download progress is implemented using the `downloadprogress` event.
