# Cataract Counselling Assistant – Phase 1

This repository contains the Phase 1 ingestion pipeline for the multi-tenant cataract counselling assistant. The goal of this phase is to build a clean, embeddable General Cataract Knowledge Base (General\_KB) ready for downstream RAG workloads.

## High-Level Flow

1. **Source configuration**  
   - `config/ingestion_sources.yaml` lists every AAO article/Q&A URL with ids, tags, and crawl hints.  
   - Multi-tenant awareness is built in (per-source metadata, clinic isolation later).

2. **Deterministic fetcher**  
   - `python -m ingestion.fetch_sources --only …` downloads raw HTML snapshots to `data/raw/html/` (articles + Q&A index/detail pages).  
   - Resilient (requests+tenacity), audit-friendly (HTML stored locally), respects robots.

3. **Parsing + extraction**  
   - `python -m ingestion.parse_sources` pulls clean sections/QA pairs from the snapshots.  
   - Articles leverage JSON-LD `articleBody`; Q&A uses `questionsDetail` blocks.  
   - Output written to `data/processed/articles.jsonl` and `qa.jsonl` with links/media preserved.

4. **Normalization & topic tagging**  
   - `python -m ingestion.normalize_records` standardizes text (Unicode cleanup, IDs) and assigns topics using `config/topic_rules.yaml`.  
   - Records and QAs unified into `data/normalized/records.jsonl`, ensuring downstream code gets deterministic schemas.

5. **Chunking (token-aware)**  
   - `python -m ingestion.chunk_records` uses `tiktoken` with a config-driven 300-token window + 60-token overlap (`config/chunker.yaml`).  
   - Keeps bullet lists intact, inherits metadata (links/media/topic) per chunk, writes `data/chunks/general_kb.jsonl`.

6. **Embeddings**  
   - `python -m ingestion.embed_chunks` loads `.env`, batches chunk text through OpenAI `text-embedding-3-small`, and stores `{chunk_id, embedding, payload}` in `data/embeddings/general_kb.jsonl`.

7. **Qdrant ingestion**  
   - `python -m ingestion.upload_qdrant --recreate` reads the embeddings file, (re)creates the `cataract_general_kb` collection with cosine distance, and upserts vectors + payload.  
   - Chunk IDs are converted to UUIDs, so Qdrant accepts them. Logging confirms upload progress.

## Environment & Credentials

- Create a virtualenv (`python -m venv venv`) and install dependencies (`pip install -r requirements.txt`).  
- Provide required secrets in `.env`:
  ```
  OPENAI_API_KEY=...
  QDRANT_URL=https://<cluster>.qdrant.io
  QDRANT_API_KEY=...
  ```

## Running the Pipeline End-to-End

1. Fetch HTML snapshots:  
   `python -m ingestion.fetch_sources`
2. Parse into structured sections/Q&A:  
   `python -m ingestion.parse_sources`
3. Normalize + topic-tag:  
   `python -m ingestion.normalize_records`
4. Chunk records:  
   `python -m ingestion.chunk_records`
5. Embed chunks:  
   `python -m ingestion.embed_chunks`
6. Upload to Qdrant:  
   `python -m ingestion.upload_qdrant --recreate`

Each stage logs counts and outputs JSONL artifacts so you can inspect or rerun individual steps without re-crawling.



Future requirements to look for:
Practical Solutions

  Short-Term (Fix Current Issue)

  Option A: Upgrade to Supabase Pro ($25/month)
  - Higher rate limits
  - Better support
  - This alone might solve your problem

  Option B: Queue-Based Registration
  Instead of creating users immediately, queue them:

  User submits form → Save to "pending_registrations" table → Background job creates auth users one by one

  Medium-Term (For 20+ Clinics)

  I can implement a registration queue system:

  1. User fills form → Saved to pending_registrations (instant)
  2. User sees: "Registration submitted! You'll receive email confirmation shortly."
  3. Background worker processes queue (1 registration every 2-3 seconds)
  4. User gets email when account is ready

  This is actually better UX because:
  - User doesn't wait for slow API calls
  - No failures due to rate limiting
  - Professional "we'll get back to you" flow


<!-- superadmin -->
admin emailid - admin@cataract.com
password - admin

<!-- clinic 1 -->
vision-forever
srinivasan@thekites.ai
annaanna

<!-- clinic 2 -->
harry@gmail.com
harry1
james - 6666666666


<!-- clinic 3 -->
real-madrid
ronaldo@gmail.com
ronaldo

