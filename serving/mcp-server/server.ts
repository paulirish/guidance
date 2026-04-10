import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerModernWebTools } from "./tools/modern-web.ts";

export function createServer() {
  const server = new McpServer({
    name: "modern-web-mcp",
    version: "1.0.0",
  });

  registerModernWebTools(server);

  return server;
}
