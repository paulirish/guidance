# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - heading "Global Grid Alignment" [level=1] [ref=e3]
    - paragraph [ref=e4]: This demo uses nested containers to organize complex layouts like full-bleed sections and consistent content columns.
  - main [ref=e5]:
    - article [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - heading "Aligned to Content Column" [level=2] [ref=e9]
          - paragraph [ref=e10]: Despite being nested deep within the hierarchy, I am positioned using calculated widths and margins to stay centered relative to the viewport.
        - generic [ref=e11]:
          - heading "Full-Bleed Layout" [level=2] [ref=e12]
          - paragraph [ref=e13]: I use relative positioning and negative viewport-width margins to break out of the parent container and touch the edges of the screen.
        - generic [ref=e14]:
          - heading "Consistent Vertical Rhythm" [level=2] [ref=e15]
          - paragraph [ref=e16]: I rely on percentage-based widths and manual left margins to approximate the alignment of the elements above me in the layout.
  - contentinfo [ref=e17]:
    - paragraph [ref=e18]: © 2026 Layout Implementation. Built for visual consistency.
```