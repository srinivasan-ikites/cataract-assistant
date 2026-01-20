"""
FastAPI application entry point.

This file maintains backward compatibility with existing deployments.
The actual application is defined in main.py.
"""
from .main import app

__all__ = ["app"]
