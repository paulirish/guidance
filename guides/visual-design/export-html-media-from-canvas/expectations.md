# Expectations

- Feature detection for HTML-in-Canvas is conducted
- The canvas element includes the content="drawable" attribute
- Every drawn HTML element and every direct child of the canvas element includes the drawable attribute
- Canvas rendering is executed inside an onpaint event handler
- The rendering logic uses drawElementImage, texElementSubImage2D, or drawElementImageToTexture
- The DOM position of each drawn HTML element matches where it is drawn
- Screen size changes are observed via ResizeObserver on the canvas
