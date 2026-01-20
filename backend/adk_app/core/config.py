"""
Core configuration and constants for the Cataract Counsellor API.
"""
from pathlib import Path
import os

# Base paths
BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
UPLOAD_ROOT = BASE_DIR / "data" / "uploads"
REVIEW_ROOT = BASE_DIR / "data" / "reviewed"
SCHEMA_DIR = Path(__file__).resolve().parents[1] / "schemas"  # adk_app/schemas/

# Upload limits
MAX_UPLOAD_FILES = int(os.getenv("MAX_UPLOAD_FILES", "20"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# Standardized controlled vocabularies for extraction consistency
STANDARD_LENS_OPTIONS = [
    "Monofocal",
    "Monofocal Toric",
    "EDOF (Extended Depth of Focus)",
    "EDOF Toric",
    "Multifocal",
    "Multifocal Toric",
    "Trifocal",
    "Trifocal Toric",
    "LAL (Light Adjustable Lens)",
    "LAL Toric"
]

STANDARD_GENDERS = ["Male", "Female", "Other"]

# Module titles for patient education content
MODULE_TITLES = [
    "My Diagnosis",
    "What is Cataract Surgery?",
    "What is an IOL?",
    "My IOL Options",
    "Risks & Complications",
    "Before Surgery",
    "Day of Surgery",
    "After Surgery",
    "Costs & Insurance",
]

# CORS configuration
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://35.244.44.106:3000",
    "http://cataract-assistant.ikites.ai",
    "https://cataract-assistant.ikites.ai",
    "https://cataract-p9pks1uzc-srinivas831s-projects.vercel.app",
    "https://cataract-8p61yr28h-srinivas831s-projects.vercel.app",
    "https://cataract-ui.vercel.app",
]

def get_cors_origins() -> list[str]:
    """Get CORS origins from environment or use defaults."""
    env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return env_origins or DEFAULT_CORS_ORIGINS
