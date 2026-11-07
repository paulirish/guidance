* Feature detection for HTML-in-Canvas is conducted before using the API
* The canvas element includes the content="drawable" attribute
* Descendant HTML elements drawn into the canvas include the drawable attribute
* Canvas rendering executes inside a paint event handler
* The texture rendering logic uses texElementSubImage2D or drawElementImageToTexture
* Texture storage is allocated at the element size from captureElementImage, rounded up
* Texture storage is reallocated only when the element size changes
* Each drawn HTML element is registered with updateElementGeometry and a canvasTransform
* Screen size changes are observed using ResizeObserver
* A fallback UI strategy is implemented when HTML-in-Canvas is not supported
