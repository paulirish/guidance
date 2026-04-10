import { BertTokenizer, env } from "@huggingface/transformers";
import * as fs from 'fs';
import * as path from 'path';

// Log original cache dir
console.log(`Original default cache dir: ${env.cacheDir}`);

// Monkey-patch fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  console.log(`[FETCH] Requested URL: ${args[0]}`);
  return originalFetch(...args);
};

async function run() {
  const customCacheDir = path.resolve('./test_cache_hf');
  console.log(`Setting custom cache dir to: ${customCacheDir}`);
  env.cacheDir = customCacheDir;
  
  // Ensure clean start
  if (fs.existsSync(customCacheDir)) {
    console.log("Cleaning up existing test cache...");
    fs.rmSync(customCacheDir, { recursive: true, force: true });
  }

  console.log("\n--- First Run (Cache Cold) ---");
  try {
    const tokenizer = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    console.log("Tokenizer loaded successfully.");
  } catch (e) {
    console.error("Error loading tokenizer:", e);
  }

  console.log("\n--- Second Run (Cache Warm) ---");
  try {
    const tokenizer2 = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    console.log("Tokenizer loaded successfully again.");
  } catch (e) {
    console.error("Error loading tokenizer:", e);
  }

  console.log(`\nTest cache kept at: ${customCacheDir}`);
}

run();
