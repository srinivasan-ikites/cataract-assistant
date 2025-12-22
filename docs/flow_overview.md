## Cataract Guide – Quick Flow Map

### Data seeds
- Clinic JSON: `backend/data/clinic/*.json` (currently hardcoded sample/ original).
- Patient JSON: `backend/data/patient/*.json` (currently hardcoded).
- Loaded by: `backend/adk_app/data_loader.py` helpers that `app.py` calls.

### Module content generation (per module cards shown in UI)
- Trigger paths:
  - Backend endpoint `POST /module-content` (`backend/adk_app/api/app.py`, `_get_missing_modules`, `_generate_and_save_missing`).
  - Backend endpoint `POST /pregenerate-modules` for upfront batch.
  - Frontend calls `api.pregenerateModules()` on page load (`cataract-ui/services/api.ts`, `App.tsx`).
- Core generator:
  - `_generate_all_modules_content` in `backend/adk_app/api/app.py` builds a single LLM prompt for all missing modules, using patient + clinic context, then parses JSON and saves via `save_patient_module_content`.

### Chat / Ask flow (RAG)
- Endpoint: `POST /ask` in `backend/adk_app/api/app.py`.
- Orchestration: `prepare_context` in `backend/adk_app/orchestration/pipeline.py`.
  - Runs **router LLM** and **embedding** in parallel, then KB search (Qdrant) using the precomputed embedding.
  - Builds context prompt from general/clinic/patient chunks.
- Final answer: `_generate_answer_with_history` in `app.py` calls the primary LLM with chat history + RAG context, expects JSON `{answer, suggestions}`; suggestions are filtered for duplicates.
- History save: `save_patient_chat_history` in `data_loader.py`.

### Prompt locations
- Module content prompt (system + user): `_generate_all_modules_content` in `backend/adk_app/api/app.py` (includes module-by-module requirements, clinic SOPs/pricing, patient facts).
- Main answer prompt: `_generate_answer_with_history` in `backend/adk_app/api/app.py` (tone, length, formatting, JSON schema with suggestions rules).
- Follow-up fallback prompt: `_generate_followup_questions` in `backend/adk_app/api/app.py`.
- Router prompt: `router_tool` in `backend/adk_app/tools/router_tool.py` (decides general/clinic/patient/topics).

### Caching & performance hooks
- LLM/router client init: FastAPI lifespan in `app.py` calls `init_router_client` and `init_qdrant_client` once.
- Qdrant client cache: `backend/adk_app/services/qdrant_service.py`.
- Gemini router client cache: `backend/adk_app/tools/router_tool.py`.
- Embedding timing: `backend/adk_app/services/embedding_service.py`.
- Parallel router + embedding: `backend/adk_app/orchestration/pipeline.py` (`ThreadPoolExecutor`).

### Frontend surfaces
- Calls to backend API: `cataract-ui/services/api.ts`.
- Module content display + pregeneration trigger: `App.tsx`.
- Chat UI: `cataract-ui/components/FAQOverlay.tsx`.

