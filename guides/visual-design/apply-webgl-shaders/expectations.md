# Expectations

- Feature detection for HTML-in-Canvas is conducted before using the API
- The canvas element includes the content="drawable" attribute
- The direct children of the canvas element include the drawable attribute
- Canvas rendering is executed inside an onpaint event handler
- The rendering logic uses texElementSubImage2D to upload HTML elements into a WebGL texture
- The WebGL texture is allocated with texImage2D at the element size from captureElementImage, rounded up
- The WebGL texture is only reallocated with texImage2D when the element size changes
- Each drawn HTML element is registered with updateElementGeometry and a canvasTransform
- A ResizeObserver is used to observe the canvas size
- A fallback UI strategy is implemented for unsupported browsers
