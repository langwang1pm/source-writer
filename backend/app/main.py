from __future__ import annotations

from fastapi import FastAPI
from app.api.enterprises import router as enterprise_router
from app.api.task_types import router as task_type_router
from app.api.workspaces import router as workspace_router

app = FastAPI(title="source-writer", version="0.1.0")

app.include_router(enterprise_router)
app.include_router(task_type_router)
app.include_router(workspace_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
