## Phase 1 Checklist

- [x] Finalise ingestion config schema and seed URL list
- [x] Implement deterministic fetcher + HTML snapshot store
- [x] Build article & Q&A extractors with validation samples
- [x] Add normalisation, topic tagging, and JSONL writers
- [x] Implement chunking pipeline (token-aware with metadata)
- [ ] Expand QA ingestion to cover /ask-an-ophthalmologist-cataract-questions search feed (discover JSON API and paginate)
- [x] Integrate OpenAI embeddings + Qdrant upsert flow
- [ ] Create validation CLI/notebook for stats and sample queries

## Phase 2 Checklist

- [x] Define clinic JSON schema and seed sample clinic data
- [x] Define patient JSON schema and stub sample patient records
- [x] Implement query router + normaliser (Gemini-based)
- [x] Build retrieval service (embed query, query Qdrant, apply topic filters)
- [x] Implement prompt builder with General/Clinic/Patient context blocks
- [x] Integrate LLM answer generator (Gemini) with safety instructions
- [x] Add structured logging/telemetry for router/retrieval/LLM steps
- [x] Expose HTTP API endpoints for the assistant (single-turn)
- [ ] So currently we will send last 10 convo to chat history, so we need to later summarize those chat, after 10 history is done. So we will keep the summay of previous 10 chats for more proper context. 










-[ ] So currently we are using rule based to get certain parts from the patients data and clinic data. So we need to try to cehck and do it within the llm itself, the routing agent, give to llm and let it decide what to do.
-[ ] So we are using many categories i.e topics, so we need to clarify this properly and finalize this.
-[ ] We need to give the conversational history
-[ ] There is router agent i.e router tool.py and we have consellor agent.py, are we using this or not?
-[ ] Is it using the ADK format or just writing a normal function. Cechk each things where ADK is involved and helping.
-[ ] Understand the RAG code clearly.
-[ ] Testing
