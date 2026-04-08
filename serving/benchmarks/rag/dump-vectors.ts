import { Embedder } from "../../mcp-server/lib/embedder.ts";

async function main() {
  // Target a highly distinct edge-case prompt
  const targetQuery = "debounce network requests for user activity";

  console.log(`Initializing embedder for numerical isolation...`);
  const embedder = Embedder.getInstance("Xenova/all-MiniLM-L6-v2@q8");
  await embedder.init();

  console.time("Vector embedding");
  const vector = await embedder.embed(targetQuery);
  console.timeEnd("Vector embedding");

  console.log(`\n--- RAW FLOAT EMISSION FOR WASM TARGET ---\n`);
  // Dump the exact first 5 dimensions to isolate any float rounding/delta differences
  console.log(JSON.stringify(vector.slice(0, 5), null, 4));
}

main().catch(console.error);
