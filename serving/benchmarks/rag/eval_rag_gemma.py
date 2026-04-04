import json
import os
from sentence_transformers import SentenceTransformer, util
import numpy as np

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VECTORS_FILE = os.path.join(ROOT_DIR, "lib", "use-cases.vectors.gen.json")
QUERIES_FILE = os.path.join(ROOT_DIR, "benchmarks", "data", "eval-queries.gen.json")
POOL_FILE = os.path.join(ROOT_DIR, "benchmarks", "data", "eval-queries-pool.json")

print(f"Loading files...")
print(f"Vectors file: {VECTORS_FILE}")

# Fallback to pool if gen file doesn't exist
if os.path.exists(QUERIES_FILE):
    queries_path = QUERIES_FILE
else:
    queries_path = POOL_FILE
print(f"Queries file: {queries_path}")

with open(VECTORS_FILE, "r") as f:
    use_cases = json.load(f)

with open(queries_path, "r") as f:
    eval_queries = json.load(f)

print(f"Loaded {len(use_cases)} use case chunks.")
print(f"Loaded {len(eval_queries)} evaluation queries.")

# Load Model
print("Loading model google/embeddinggemma-300M...")
model = SentenceTransformer("google/embeddinggemma-300M")

# Prepare Documents (Use Case Descriptions)
documents = []
doc_mappings = [] # Keep track of which doc belongs to which guideId

for item in use_cases:
    desc = item.get("description", "")
    if desc:
        documents.append(f"title: none | text: {desc}")
        doc_mappings.append(item["id"])

print(f"Encoding {len(documents)} documents...")
doc_embeddings = model.encode(documents, convert_to_tensor=True)
print("Encoding complete.")

# Function to run search
def search(query, top_k=5):
    query_prefixed = f"task: search result | query: {query}"
    query_embedding = model.encode([query_prefixed], convert_to_tensor=True)
    
    # Use util.cos_sim for safe shape handling
    cos_scores = util.cos_sim(query_embedding, doc_embeddings)[0]
    
    # Get top results
    import torch
    top_results = torch.topk(cos_scores, k=min(top_k, len(documents)))
    
    results = []
    for score, idx in zip(top_results.values, top_results.indices):
        results.append({
            "id": doc_mappings[idx.item()],
            "score": score.item()
        })
    return results

# Evaluate
print("Running evaluation...")
total = 0
top1_hits = 0
top3_hits = 0
mrr = 0

limit = len(eval_queries) # Run all queries
sample_queries = eval_queries[:limit]

for i, q in enumerate(sample_queries):
    query_text = q["query"]
    target_id = q["guideId"]
    
    results = search(query_text, top_k=5)
    
    total += 1
    
    # Check hits
    hit_rank = -1
    for rank, r in enumerate(results):
        if r["id"] == target_id:
            hit_rank = rank + 1
            break
            
    if hit_rank == 1:
        top1_hits += 1
    if hit_rank > 0 and hit_rank <= 3:
        top3_hits += 1
        
    if hit_rank > 0:
        mrr += 1.0 / hit_rank
        
    if i % 10 == 0:
        print(f"Processed {i}/{len(sample_queries)}...")

print(f"\n=== Results ({total} queries) ===")
print(f"Top-1 Hit Rate: {top1_hits / total:.4f}")
print(f"Top-3 Hit Rate: {top3_hits / total:.4f}")
print(f"MRR: {mrr / total:.4f}")
print(f"==============================")
