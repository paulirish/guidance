# Page snapshot

```yaml
- generic [ref=e1]:
  - button "Process Data" [active] [ref=e2]
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Log" [level=3] [ref=e5]
      - generic [ref=e6]: "{ \"id\": 101, \"info\": { \"secret\": \"PRIVATE_KEY_123\", \"tags\": {} }, \"created\": \"2026-04-24T23:43:49.482Z\" }"
    - generic [ref=e7]:
      - heading "Current Data" [level=3] [ref=e8]
      - generic [ref=e9]: "{ \"id\": 101, \"info\": { \"secret\": \"[REDACTED]\", \"tags\": {} }, \"created\": \"2026-04-24T23:43:49.482Z\", \"processed\": true }"
```