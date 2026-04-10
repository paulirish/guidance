# This project uses Build-Free TypeScript Execution

Native TS execution (Node v24.11+) is enabled via **Erasable Syntax**. No `tsx` or build step required.

### Commands
- **Run Server**: `node mcp-server/index.ts`
- **Run Scripts**: `node scripts/build-guides.ts`
- **Type Check**: `pnpm run typecheck`

### Rules
1. **Erasable Syntax**: No `enum`, `namespace`, or parameter properties.
2. **Explicit Types**: Use `import type`.
3. **Extensions**: Use `.ts` in all import paths.
