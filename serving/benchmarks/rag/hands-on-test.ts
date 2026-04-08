import { Embedder } from "../../mcp-server/lib/embedder.ts";
import { searchUseCases } from "../../lib/search.ts";
import fs from "fs";
import path from "path";

async function testQueryOnModel(modelName: string, query: string, label: string) {
  console.log(`\n===================================================`);
  console.log(`[${label}] Query: "${query}"`);
  console.log(`Model: ${modelName}`);
  console.log(`===================================================`);

  // 1. Force the embedder singleton to switch models
  const embedder = Embedder.getInstance(modelName);
  await embedder.init();

  // 2. Perform the search (which embeds the query and runs pure JS cosine math)
  const results = await searchUseCases(query, 3, 2.0); // Very wide max distance to catch everything

  console.log(`Top 3 Retrieved Vectors:`);
  for (let i = 0; i < Math.min(results.length, 3); i++) {
    const r = results[i];
    console.log(`  #${i + 1} | Distance: ${parseFloat(r.distance).toFixed(3)} | Guide: ${r.id}`);
    console.log(`       Desc: ${r.description}`);
  }
}

async function main() {
  const models = [
    "Xenova/all-MiniLM-L6-v2@q8",
    "onnx-community/embeddinggemma-300m-ONNX@q4"
  ];

  const tests = [
    { query: "debounce network requests for user activity", label: "HYPER-RELEVANT" },
    { query: "how to cook a medium rare ribeye steak", label: "UNRELATED DOMAIN" },
    { query: "asdfqwer zxcvbnm 1234567890 !@#$%^&*", label: "PURE GIBBERISH" }
  ];

  for (const model of models) {
    // We must regenerate the static vector store specifically for the target model 
    // because the pure JS file caches the vectors for one model at a time.
    console.log(`\n\n>>> Building vector store cache for ${model}...`);
    // Recreate the embedder singleton instance cleanly
    const emb = Embedder.getInstance(model);
    await emb.init();
    
    // Use standard build-guides logic or just trust the CLI script to do it
    const { execSync } = await import("child_process");
    // We can pass ENV variables to force the model during build-guides
    execSync(`node scripts/build-guides.ts`, { 
       env: { ...process.env, EMBEDDING_MODEL: model },
       stdio: 'ignore' 
    });

    for (const t of tests) {
       await testQueryOnModel(model, t.query, t.label);
    }
  }
}

main().catch(console.error);
