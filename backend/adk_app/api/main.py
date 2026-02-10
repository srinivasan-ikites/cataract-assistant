"""
Main FastAPI application setup.

This is the refactored entry point that replaces the monolithic app.py.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import litellm
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adk_app.core.config import get_cors_origins
from adk_app.services.extraction_service import init_vision_client
from adk_app.services.qdrant_service import init_qdrant_client
from adk_app.services.supabase_service import init_supabase_client
from adk_app.tools.router_tool import init_router_client
from adk_app.api.middleware.request_context import RequestContextMiddleware

from .routes import api_router

# Configure litellm
litellm.drop_params = True  # Avoid unsupported parameter errors on certain models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize heavy clients at startup to avoid latency on first request.
    """
    print("\n[Startup] Initializing Global Clients...")
    try:
        # 1. Warm up Router (Gemini)
        init_router_client()

        # 2. Warm up Vector DB (Qdrant)
        init_qdrant_client()

        # 3. Warm up Vision extraction (Google AI Studio)
        init_vision_client()

        # 4. Initialize Supabase client (Database + Storage)
        init_supabase_client()

        print("[Startup] All clients ready.\n")
    except Exception as e:
        print(f"[Startup] Error initializing clients: {e}")

    yield

    # Cleanup if needed
    print("[Shutdown] Cleaning up...")


# Create the FastAPI application
app = FastAPI(
    title="Cataract Counselor API",
    description="API for the Cataract Surgery Counselling Assistant",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request context middleware (logging with user identification)
# This runs BEFORE route handlers, logging request start/end with user context
app.add_middleware(RequestContextMiddleware)

# Include all routes
app.include_router(api_router)
