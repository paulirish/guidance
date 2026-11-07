# Expectations

- The image element with class .shaped-avatar has mask-image and -webkit-mask-image properties applied referencing a valid SVG mask ID
- The decorative empty element with class .card-accent has mask-image and -webkit-mask-image properties applied referencing a valid SVG mask ID
- The SVG masks use maskContentUnits="objectBoundingBox" to scale correctly with element dimensions
- The parent container .unified-card uses filter: drop-shadow() to silhouette the unified card and adjacent masked element
- Safe layout practices are followed where all readable text content remains entirely within the standard unmasked container .card-body to prevent clipping
- The element with class .gradient-masked-card has a pure CSS radial or linear gradient applied to the mask-image and -webkit-mask-image properties
