# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - heading "Request Interception" [level=1] [ref=e3]
    - generic [ref=e5]: ✓ System Ready
  - main [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e8]: This implementation uses manual string parsing and regular expressions within a Service Worker to intercept and process API requests.
      - generic [ref=e9]:
        - button "Fetch /api/books/101" [ref=e10] [cursor=pointer]
        - button "Fetch /api/users/jdoe/profile" [ref=e11] [cursor=pointer]
        - button "Fetch /api/other/resource" [ref=e12] [cursor=pointer]
      - generic [ref=e13]: Click a button to see the intercepted response.
    - generic [ref=e14]:
      - heading "How it works" [level=3] [ref=e15]
      - paragraph [ref=e16]:
        - text: The Service Worker analyzes the request URL using
        - code [ref=e17]: split()
        - text: and
        - code [ref=e18]: indexOf()
        - text: . It then extracts parameters by index from the resulting array to generate responses.
```