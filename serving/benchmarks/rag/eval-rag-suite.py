# /// script
# dependencies = [
#   "sentence-transformers",
#   "scikit-learn",
#   "numpy",
# ]
# ///

import os
import json
import glob
import random
from sentence_transformers import SentenceTransformer, util

def chunk_markdown(content: str) -> list[str]:
    # Naive split on headings
    parts = content.split("\n## ")
    chunks = []
    if parts:
        chunks.append(parts[0])
        for p in parts[1:]:
            chunks.append(f"## {p}")
    return [c.strip() for c in chunks if c.strip()]

def main():
    print("Loading PyTorch EmbeddingGemma 300m model on CPU (to avoid MPS NaN bugs)...")
    model = SentenceTransformer("google/embeddinggemma-300m", device="cpu")
    
    # Locate paths relative to this script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    guides_dir = os.path.abspath(os.path.join(script_dir, "../../../guides"))
    queries_path = os.path.abspath(os.path.join(script_dir, "../data/eval-queries-pool.json"))

    print(f"Reading guides from {guides_dir}...")
    
    if not os.path.exists(guides_dir):
        print(f"[ERROR] Directory does not exist: {guides_dir}")
        return

    # Scan for `guide.md` files anywhere under the guides_dir tree
    guide_files = []
    import glob
    for gf in glob.glob(os.path.join(guides_dir, "**/guide.md"), recursive=True):
        guide_files.append(gf)
    
    documents = []
    doc_metadata = [] # map index to guideId and chunk
    
    for gf in guide_files:
        if "node_modules" in gf or "expectations.md" in gf:
            continue
        
        guide_id = os.path.basename(os.path.dirname(gf))
        
        try:
            with open(gf, "r", encoding="utf-8") as f:
                content = f.read()
                
            chunks = chunk_markdown(content)
            for chunk in chunks:
                # Apply asymmetric prompt for documents
                prompted_text = f"title: none | text: {guide_id}\n\n{chunk}"
                documents.append(prompted_text)
                doc_metadata.append({"guide_id": guide_id, "chunk": chunk})
        except Exception as e:
            # Skip unparseable files
            continue

    if not documents:
        print("No documents found to index!")
        return

    print(f"Encoding {len(documents)} document chunks...")
    doc_embeddings = model.encode(documents, convert_to_tensor=True, show_progress_bar=True)

    print(f"Reading queries from {queries_path}...")
    with open(queries_path, "r", encoding="utf-8") as f:
        master_queries = json.load(f)

    # Dictionary query by guideId
    guide_queries = {}
    for q in master_queries:
        gid = q["guideId"]
        if gid not in guide_queries:
            guide_queries[gid] = []
        guide_queries[gid].append(q)

    # Sample 5 random queries per guide, same as JS
    active_queries = []
    for gid, queries in guide_queries.items():
        subset = random.sample(queries, min(len(queries), 5))
        active_queries.extend(subset)

    print(f"Evaluating accuracy on {len(active_queries)} sampled queries...")
    
    top1_hits = 0
    top3_hits = 0
    rr_sum = 0.0

    for idx, q in enumerate(active_queries):
        query_text = q["query"]
        target_guide = q["guideId"]

        # Apply asymmetric prompt for queries
        prompted_query = f"task: search result | query: {query_text}"
        query_embedding = model.encode([prompted_query], convert_to_tensor=True, show_progress_bar=False)

        # Compute cosine similarities between query and all docs
        cos_scores = util.cos_sim(query_embedding, doc_embeddings)[0]
        
        # Sort scores in descending order
        # To be safe across PyTorch versions, use sort()[1] which returns indices
        # We need largest values first!
        top_results = cos_scores.argsort(descending=True)

        found_rank = 0
        if idx == 0:
            print(f"\n[DEBUG] Query: '{query_text}'")
            print(f"[DEBUG] Target guide: '{target_guide}'")
            print(f"[DEBUG] Cos scores (raw): {cos_scores[:5]}")
            print(f"[DEBUG] Top results indices: {top_results[:5]}")
            print(f"[DEBUG] Top results values: {[cos_scores[i].item() for i in top_results[:5]]}")
            
        for i in range(min(5, len(top_results))):
            doc_idx = top_results[i].item()
            metadata = doc_metadata[doc_idx]
            
            if idx == 0:
                print(f"[DEBUG] Found Top-{i+1}: '{metadata['guide_id']}'")
                
            if metadata["guide_id"] == target_guide:
                found_rank = i + 1
                break

        if found_rank == 1:
            top1_hits += 1
        if 0 < found_rank <= 3:
            top3_hits += 1
        
        if found_rank > 0:
            rr_sum += 1.0 / found_rank

    num_evals = len(active_queries)
    if num_evals > 0:
        top1_rate = (top1_hits / num_evals) * 100
        top3_rate = (top3_hits / num_evals) * 100
        mrr = rr_sum / num_evals
        
        print("\n=== PURE PYTHON PYTORCH GEMMA EVALUATION ===")
        print(f"Total Evaluations: {num_evals}")
        print(f"Top-1 Hit Rate:  {top1_rate:.2f}%")
        print(f"Top-3 Hit Rate:  {top3_rate:.2f}%")
        print(f"MRR:             {mrr:.4f}")
    else:
        print("No queries evaluated.")

if __name__ == "__main__":
    main()
