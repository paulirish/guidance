# Expectations for Animate To/From Top Layer

- The <dialog> element includes "overlay" and "display" in its transition properties with "allow-discrete".
- The [popover] element includes "overlay" and "display" in its transition properties with "allow-discrete".
- The <dialog> element uses the @starting-style at-rule.
- The [popover] element uses the @starting-style at-rule.
- The <dialog> element smoothly transitions when opened.
- The <dialog> element smoothly transitions when closed.
- The [popover] element smoothly transitions when opened.
- The <dialog> ::backdrop is animated.
- The implementation respects prefers-reduced-motion.
