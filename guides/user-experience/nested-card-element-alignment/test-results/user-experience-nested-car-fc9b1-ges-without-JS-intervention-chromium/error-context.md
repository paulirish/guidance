# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - text: Short Title
      - generic [ref=e5]: Extra Content
    - generic [ref=e6]: This is some content. It is quite short.
    - generic [ref=e7]: Footer 1
  - generic [ref=e8]:
    - generic [ref=e9]: A Much Longer Title That Will Definitely Wrap Around To Multiple Lines
    - generic [ref=e10]: This card has significantly more content. Because it uses flexbox without subgrid, the internal sections will not align with the card next to it. Each card calculates its own height based on its specific content.
    - generic [ref=e11]: Footer 2
  - generic [ref=e12]:
    - generic [ref=e13]: Fixed Height Header
    - generic [ref=e14]:
      - text: This section uses a fixed height of 120px and overflow scroll. This is a brittle way to attempt layout consistency and ignores the dynamic nature of content.
      - text: More text to force scrolling... More text to force scrolling... More text to force scrolling...
    - generic [ref=e15]: No Footer Here
```