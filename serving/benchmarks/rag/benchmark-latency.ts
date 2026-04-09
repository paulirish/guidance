import { Embedder } from "../../mcp-server/lib/embedder.ts";
import fs from "fs";
import path from "path";

async function run() {
    const currentDir = import.meta.dirname;
    const queriesFile = path.resolve(currentDir, "../../benchmarks/data/eval-queries-pool.json");
    console.log(`Loading queries from ${queriesFile}...`);
    
    const allQueries = JSON.parse(fs.readFileSync(queriesFile, "utf-8"));
    const query = allQueries[0].query;
    
    console.log(`Using query: "${query}" for end-to-end benchmark.`);
    
    const RUNS = 3;
    
    // --- Legacy Stack (Transformers.js / Native ONNX) ---
    console.log("\n=== Benchmarking Legacy Stack (Transformers.js / Native ONNX) ===");
    const runs: number[] = [];
    let total = 0;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        
        const start = Date.now();
        const embedder = Embedder.getInstance();
        await embedder.init();
        await embedder.embed(query);
        const duration = Date.now() - start;
        total += duration;
        runs.push(duration);
        console.log(`  Duration: ${duration}ms`);
    }
    const avg = total / RUNS;
    console.log(`Legacy Stack Avg E2E Latency: ${avg.toFixed(2)}ms`);
    
    console.log("\n=== Summary (End-to-End Latency for 1 Query) ===");
    console.log(`Legacy Stack Avg E2E Latency: ${avg.toFixed(2)}ms`);
    
    // Record results
    const resultsFile = path.resolve(currentDir, "../../benchmarks/data/eval-results-latency.json");
    if (fs.existsSync(resultsFile)) {
        console.log(`\nRecording results to ${resultsFile}...`);
        const results = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
        const timestamp = new Date().toISOString();
        
        results.push({
            timestamp,
            model: "minilm q8 - trjs onnx native - legacy",
            type: "e2e-latency-1-query",
            avgLatencyMs: parseFloat(avg.toFixed(2)),
            runs: runs
        });
        
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log("Results recorded.");
    } else {
        console.log(`\nResults file not found: ${resultsFile}. Skipping recording.`);
    }
}

run().catch(console.error);
