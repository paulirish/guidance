To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* Use background to color the thumb. Supports fallback if variables not defined. */
    background: var(--scrollbar-thumb, hotpink);
    border-radius: 6px;
  }
  .scroller::-webkit-scrollbar-track {
    /* Use background to color the track. Supports fallback if variables not defined. */
    background: var(--scrollbar-track, blue);
  }
}
```
