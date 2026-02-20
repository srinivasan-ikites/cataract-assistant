"""
Request Context Middleware for logging with user identification.

This middleware:
1. Generates a unique request ID for each request
2. Logs request START with user context (if available)
3. Logs request END with status code and duration
4. Makes request_id available throughout the request lifecycle

The user context is extracted from:
- Clinic users: request.state.user (set by auth middleware)
- Patients: Authorization header JWT
- Public routes: patient_id/clinic_id from request body (best effort)

Log format:
[REQ-abc123] [user:doctor@clinic.com] [clinic:VIC-001] [role:clinic_user] -> POST /doctor/uploads/patient
[REQ-abc123] [user:doctor@clinic.com] <- 200 OK (245ms)
"""

from __future__ import annotations

import time
import uuid
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from adk_app.api.middleware.patient_token import decode_patient_token
from adk_app.telemetry.logger import get_logger

logger = get_logger("request")

try:
    import newrelic.agent
    HAS_NEW_RELIC = True
except ImportError:
    HAS_NEW_RELIC = False


def generate_request_id() -> str:
    """Generate a short unique request ID."""
    return uuid.uuid4().hex[:8]


def get_user_context(request: Request) -> dict:
    """
    Extract user context from the request.

    Priority:
    1. Clinic user from request.state.user (set by auth middleware)
    2. Patient from Authorization header JWT
    3. Patient ID from request body (for public routes)
    """
    context = {
        "user": None,
        "clinic": None,
        "role": None,
        "patient_id": None,
    }

    # 1. Check for authenticated clinic user (set by auth middleware AFTER this runs)
    #    This will be available on authenticated routes
    if hasattr(request.state, "user") and request.state.user:
        user = request.state.user
        context["user"] = getattr(user, "email", None)
        context["clinic"] = getattr(user, "clinic_id", None)
        context["role"] = getattr(user, "role", None)
        return context

    # 2. Check for patient JWT token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        payload = decode_patient_token(token)
        if payload:
            context["patient_id"] = payload.get("patient_id")
            context["clinic"] = payload.get("clinic_id")
            context["role"] = "patient"
            return context

    return context


def set_newrelic_attributes(request: Request, user_context: dict, request_id: str, status_code: int = 0, duration_ms: float = 0, error: str = None):
    """Tag the current New Relic transaction with user context and request details."""
    if not HAS_NEW_RELIC:
        return
    try:
        newrelic.agent.add_custom_attribute('request_id', request_id)
        newrelic.agent.add_custom_attribute('endpoint', f"{request.method} {request.url.path}")
        newrelic.agent.add_custom_attribute('http_method', request.method)
        newrelic.agent.add_custom_attribute('url_path', request.url.path)

        if status_code:
            newrelic.agent.add_custom_attribute('http_status', status_code)
        if duration_ms:
            newrelic.agent.add_custom_attribute('duration_ms', round(duration_ms, 1))

        # User context
        if user_context.get("user"):
            newrelic.agent.add_custom_attribute('user_email', user_context["user"])
        if user_context.get("patient_id"):
            newrelic.agent.add_custom_attribute('patient_id', user_context["patient_id"])
        if user_context.get("clinic"):
            newrelic.agent.add_custom_attribute('clinic_id', user_context["clinic"])
        if user_context.get("role"):
            newrelic.agent.add_custom_attribute('user_role', user_context["role"])

        # Error context
        if error:
            newrelic.agent.add_custom_attribute('error_message', str(error)[:500])
    except Exception:
        pass  # Never let NR instrumentation break the app


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds request context and logging.

    For every request:
    1. Generates unique request ID
    2. Logs request start with available context
    3. Logs request end with status and duration
    """

    # Paths to skip logging (noisy health checks, static files)
    SKIP_PATHS = {"/healthz", "/health", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip logging for health checks and static files
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Skip static file requests
        if any(request.url.path.endswith(ext) for ext in [".js", ".css", ".ico", ".png", ".jpg", ".svg"]):
            return await call_next(request)

        # Generate request ID
        request_id = generate_request_id()
        request.state.request_id = request_id

        # Get initial user context (may be empty for authenticated routes at this point)
        # Auth middleware runs AFTER this, so we'll log again in auth if user is found
        start_time = time.perf_counter()

        # Try to extract patient_id from body for public routes (best effort)
        body_context = ""
        if request.method == "POST" and request.url.path in ["/ask", "/module-content", "/pregenerate-modules"]:
            try:
                # Read body without consuming it
                body = await request.body()
                # Create a new receive that returns the body we already read
                async def receive():
                    return {"type": "http.request", "body": body}
                request._receive = receive

                body_json = json.loads(body)
                patient_id = body_json.get("patient_id")
                clinic_id = body_json.get("clinic_id")
                if patient_id:
                    body_context = f" [patient:{patient_id}]"
                if clinic_id:
                    body_context += f" [clinic:{clinic_id}]"
            except:
                pass

        # Log request start
        logger.info(
            "request_start",
            extra={"request_id": request_id, "method": request.method, "path": request.url.path},
        )

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Get user context (now auth middleware may have set it)
            user_context = get_user_context(request)

            # Build structured log extra fields
            log_extra = {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 1),
                **{k: v for k, v in user_context.items() if v},
            }

            # Log at appropriate level based on status code
            if response.status_code >= 500:
                logger.error("request_error", extra=log_extra)
            elif response.status_code >= 400:
                logger.warning("request_client_error", extra=log_extra)
            else:
                logger.info("request_end", extra=log_extra)

            # Tag New Relic transaction with user context
            set_newrelic_attributes(request, user_context, request_id, response.status_code, duration_ms)

            # Explicitly report server errors to New Relic so alerts fire.
            # Without notice_error(), a 500 returned via HTTPException is just
            # a "successful transaction that returned 500" — New Relic won't
            # classify it as an error and alerts won't trigger.
            if response.status_code >= 500 and HAS_NEW_RELIC:
                try:
                    newrelic.agent.notice_error(
                        attributes={
                            'request_id': request_id,
                            'endpoint': f"{request.method} {request.url.path}",
                            'status_code': response.status_code,
                        }
                    )
                except Exception:
                    pass

            # Add request ID to response headers (useful for debugging)
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as exc:
            # Log unhandled exception as ERROR with full context
            duration_ms = (time.perf_counter() - start_time) * 1000
            user_context = get_user_context(request)
            logger.error(
                "unhandled_exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "duration_ms": round(duration_ms, 1),
                    "error": str(exc),
                    **{k: v for k, v in user_context.items() if v},
                },
                exc_info=True,
            )

            # Tag New Relic with error context
            set_newrelic_attributes(request, user_context, request_id, 500, duration_ms, error=str(exc))

            # Explicitly report unhandled exceptions to New Relic
            if HAS_NEW_RELIC:
                try:
                    newrelic.agent.notice_error()
                except Exception:
                    pass

            raise
