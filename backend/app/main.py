from __future__ import annotations

from fastapi import FastAPI
from app.api.enterprises import router as enterprise_router
from app.api.task_types import router as task_type_router
from app.api.workspaces import router as workspace_router
from app.api.sessions import router as session_router
from app.api.chat_messages import router as chat_message_router
from app.api.uploaded_files import router as uploaded_file_router
from app.api.response_docs import router as response_doc_router
from app.api.message_blocks import router as message_block_router
from app.api.source_refs import router as source_ref_router

app = FastAPI(title="source-writer", version="0.1.0")

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
