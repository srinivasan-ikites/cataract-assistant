## Phase 1 (Ingestion/RAG foundation) – DONE
- [x] Finalise ingestion config schema and seed URL list
- [x] Implement deterministic fetcher + HTML snapshot store
- [x] Build article & Q&A extractors with validation samples
- [x] Add normalisation, topic tagging, and JSONL writers
- [x] Implement chunking pipeline (token-aware with metadata)
- [ ] Expand QA ingestion to cover /ask-an-ophthalmologist-cataract-questions search feed (discover JSON API and paginate)
- [x] Integrate OpenAI embeddings + Qdrant upsert flow
- [ ] Create validation CLI/notebook for stats and sample queries

## Phase 2 (Assistant) – DONE/ONGOING
- [x] Define clinic JSON schema and seed sample clinic data
- [x] Define patient JSON schema and stub sample patient records
- [x] Implement query router + normaliser (Gemini-based)
- [x] Build retrieval service (embed query, query Qdrant, apply topic filters)
- [x] Implement prompt builder with General/Clinic/Patient context blocks
- [x] Integrate LLM answer generator (Gemini) with safety instructions
- [x] Add structured logging/telemetry for router/retrieval/LLM steps
- [x] Expose HTTP API endpoints for the assistant (single-turn)
- [ ] Summarize chat history after 10 turns to keep context window small

## Phase 3 (Doctor Upload + Extraction) – NEW
- [x] Backend API: upload images (EMR + optional biometry) → Vision LLM extraction to patient schema (see `docs/schemas/patient_schema.json`)
- [x] Backend API: upload clinic documents (one-time) → Vision LLM extraction to clinic schema (`docs/schemas/clinic_schema.json`)
- [x] Extraction prompt + schema-fill: constrain to schema, normalize dates/gender/lens; model infers doc types implicitly (no explicit classifier)
- [ ] Confidence flags/doc-type scoring: add per-field confidence & explicit doc-type classification for UI highlighting
- [x] Storage: save uploads under `backend/data/uploads/{clinic_id}/{patient_id}/` and keep raw extraction + reviewed JSON under `backend/data/reviewed/...`
- [x] Manual gaps: schema-fill ensures missing keys are present with empty/null defaults
- [ ] CLI/Swagger test flow: call upload API with local images, inspect extraction JSON

## Phase 4 (Doctor Dashboard UI) – DONE
- [x] Doctor dashboard shell with patient list (seed 3 demo patients)
- [x] Patient detail page: upload area, show extracted JSON with confidence flags, editable inputs/dropdowns, validation on save
- [x] Clinic setup page: one-time upload + editable review UI; save to clinic JSON store
- [x] Save flow: persist reviewed JSON to `data/reviewed/...`
- [ ] Finalize pre-generation trigger from UI
- [x] Clean, premium medical UI implementation

## Phase 5 (Activation & Integration) – NEW
- [ ] Backend: Update `get_patient_data` / `get_clinic_data` to prioritize `data/reviewed/` folder
- [ ] Backend: Create `/doctor/finalize/patient` endpoint to sync reviewed data and trigger pre-gen
- [ ] UI: Add "Publish to Patient Portal" button with status tracking
- [ ] Logic: Ensure module generation uses the EXACT reviewed JSON keys

## Phase 6 (Refinement & Testing)
- [ ] Test with multiple real EMR samples (images first; PDFs later)
- [ ] Prompt refinement for extraction accuracy; add doc-type hinting
- [ ] Add IOL catalog/dropdowns for lens options; align with clinic catalog
- [ ] Performance: consider batching pages; optionally parallel OCR
- [ ] Regression pass on RAG + chat after onboarding changes

