"""Aggregates all v1 routers under /api/v1."""

from fastapi import APIRouter

from app.api import dashboard, documents, reports

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(documents.router)
api_router.include_router(reports.router)
api_router.include_router(dashboard.router)
