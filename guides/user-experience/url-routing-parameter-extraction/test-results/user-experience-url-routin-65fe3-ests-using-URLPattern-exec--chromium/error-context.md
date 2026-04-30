# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Home" [ref=e3] [cursor=pointer]:
      - /url: /
    - link "Admin Profile" [active] [ref=e4] [cursor=pointer]:
      - /url: /user/admin/profile
    - link "Latest Post" [ref=e5] [cursor=pointer]:
      - /url: /posts/hello-world
  - generic [ref=e6]:
    - generic [ref=e7]: Current View
    - generic [ref=e8]: User Management
    - generic [ref=e9]: Parameters
    - generic [ref=e10]: "User: admin, Action: profile"
```