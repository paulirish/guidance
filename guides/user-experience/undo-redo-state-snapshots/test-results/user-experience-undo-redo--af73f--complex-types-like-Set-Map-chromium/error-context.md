# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "System Dashboard" [level=1] [ref=e3]
  - generic [ref=e4]:
    - button "Add Record" [ref=e5]
    - button "Undo Action" [active] [ref=e6]
    - button "Redo Action" [ref=e7]
  - generic [ref=e8]:
    - heading "Current Records" [level=3] [ref=e9]
    - list [ref=e10]:
      - listitem [ref=e11]: System Boot
      - listitem [ref=e12]: Event 2
  - generic [ref=e13]:
    - heading "Debug Info" [level=3] [ref=e14]
    - generic [ref=e15]: "{ \"sessionStarted\": \"2026-04-24T23:52:32.135Z\", \"typeOfDate\": \"string\", \"isDateObject\": false, \"items\": [ { \"id\": 1, \"info\": { \"label\": \"System Boot\" } }, { \"id\": 2, \"info\": { \"label\": \"Event 2\" } } ], \"settings\": {}, \"isSetObject\": false }"
```