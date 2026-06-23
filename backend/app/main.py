
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.enterprises import router as enterprise_router
from app.api.task_types import router as task_type_router
from app.api.workspaces import router as workspace_router
from app.api.sessions import router as session_router
from app.api.chat_messages import router as chat_message_router
from app.api.uploaded_files import router as uploaded_file_router
from app.api.response_docs import router as response_doc_router
from app.api.message_blocks import router as message_block_router
from app.api.source_refs import router as source_ref_router

_sync_task: asyncio.Task | None = None


async def _sync_loop():
    import asyncpg
    import httpx
    from app.config import settings

    dsid = settings.dify_dataset_id
    api_key = settings.dify_dataset_api_key or settings.dify_app_api_key
    if not dsid or not api_key:
        return

    base = settings.dify_base_url + "/v1/datasets/" + dsid + "/documents"
    hdrs = {"Authorization": "Bearer " + api_key}
    dsn = settings.database_url.replace("+asyncpg", "")

    while True:
        try:
            conn = await asyncpg.connect(dsn=dsn)
            rows = await conn.fetch(
                "SELECT id, dify_document_id, status "
                "FROM sourcewriter.uploaded_file "
                "WHERE deleted_at IS NULL "
                "AND dify_document_id IS NOT NULL "
                "AND status NOT IN ('available','completed','error')"
            )
            for row in rows:
                async with httpx.AsyncClient() as c:
                    doc_url = base + "/" + row["dify_document_id"]
                    r = await c.get(doc_url, headers=hdrs, timeout=10)
                    if r.status_code == 200:
                        s = r.json().get("indexing_status")
                        if s and s != row["status"]:
                            await conn.execute(
                                "UPDATE sourcewriter.uploaded_file "
                                "SET status = $1 WHERE id = $2",
                                s, row["id"]
                            )
            await conn.close()
        except Exception:
            pass
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sync_task
    _sync_task = asyncio.create_task(_sync_loop())
    yield
    if _sync_task:
        _sync_task.cancel()


app = FastAPI(title="source-writer", version="0.1.0", lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enterprise_router)
app.include_router(task_type_router)
app.include_router(workspace_router)
app.include_router(session_router)
app.include_router(chat_message_router)
app.include_router(uploaded_file_router)
app.include_router(response_doc_router)
app.include_router(message_block_router)
app.include_router(source_ref_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


