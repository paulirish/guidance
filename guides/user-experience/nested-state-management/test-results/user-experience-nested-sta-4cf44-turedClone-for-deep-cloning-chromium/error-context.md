# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "Primary Data" [level=3] [ref=e4]
      - generic [ref=e5]: "{ \"meta\": { \"version\": 1, \"auth\": { \"roles\": [ \"user\" ], \"timestamp\": \"2026-04-24T23:47:00.510Z\" } }, \"items\": [ \"init\" ] }"
    - generic [ref=e6]:
      - heading "Temporary Buffer" [level=3] [ref=e7]
      - generic [ref=e8]: "{ \"meta\": { \"version\": 1, \"auth\": { \"roles\": [ \"user\" ], \"timestamp\": \"2026-04-24T23:47:00.510Z\" } }, \"items\": [ \"init\" ] }"
  - generic [ref=e9]:
    - button "Generate Buffer" [active] [ref=e10] [cursor=pointer]
    - button "Update Nested Data" [ref=e11] [cursor=pointer]
    - button "Apply JSON Logic" [ref=e12] [cursor=pointer]
  - generic [ref=e13]: Buffer created using spread operator.
```