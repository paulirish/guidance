#!/usr/bin/env node
import { Embedder } from "../lib/embedder.js";
import { Store } from "../lib/store.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Error: match string required");
    console.error("Usage: node search.js <query>");
    process.exit(1);
  }

  const query = args.join(" ");
  
  try {
    const embedder = Embedder.getInstance();
    const store = new Store();

    const vector = await embedder.embed(query);
    const results = await store.search(vector, 3);

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    process.exit(1);
  }
}

main();
