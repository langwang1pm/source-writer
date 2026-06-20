from __future__ import annotations

import json
import mimetypes


import httpx

from app.config import settings


class DifyWorkflowClient:
    """Async client for Dify Workflow API (upload document processing workflow)."""

    def __init__(self) -> None:
        self.base_url: str = settings.dify_base_url.rstrip("/")
        self.api_key: str = settings.dify_workflow_api_key
        self.app_id: str = settings.dify_workflow_app_id

    async def upload_file_to_dify(
        self, file_path: str, file_name: str,
    ) -> dict | None:
        """Upload a file to Dify's file storage via /v1/files/upload.

        Returns the file info dict with keys: id, name, size, extension, mime_type.
        """
        if not self.base_url or not self.api_key:
            return None

        url = f"{self.base_url}/v1/files/upload"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        mime_type, _ = mimetypes.guess_type(file_name)
        if not mime_type:
            mime_type = "application/octet-stream"

        timeout = httpx.Timeout(120.0, connect=10.0, read=120.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            with open(file_path, "rb") as f:
                files = {"file": (file_name, f, mime_type)}
                resp = await client.post(url, headers=headers, files=files)
            if resp.status_code not in (200, 201):
                return None
            result = resp.json()
            return result

    async def run_chatflow(
        self, enterprise_id: str, file_info: dict,
    ) -> dict | None:
        """Run the upload document processing Chatflow."""
        if not self.base_url or not self.api_key:
            return None

        url = f"{self.base_url}/v1/chat-messages"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "inputs": {
                "enterprise_id": enterprise_id,
               "enterpris_files": {
                    "type": "document",
                    "transfer_method": "local_file",
                    "url": "",
                    "upload_file_id": file_info.get("id", ""),
                },
            },
            "query": "Upload document to knowledge base",
            "response_mode": "blocking",
            "user": "source-writer",
        }

        timeout = httpx.Timeout(300.0, connect=10.0, read=300.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                return None
            result = resp.json()
            dify_document_id = result.get("dify_document_id", "") or ""
            if not dify_document_id:
                import re
                match = re.search(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', result.get("answer", ""))
                if match:
                    dify_document_id = match.group(0)
            metadata = result.get("metadata", {}) or {}
            if not dify_document_id:
                retriever = metadata.get("retriever_resources", [])
                if retriever and isinstance(retriever, list) and len(retriever) > 0:
                    dify_document_id = retriever[0].get("document_id", "")
            if dify_document_id:
                return {"dify_document_id": dify_document_id}
            return None

dify_workflow_client = DifyWorkflowClient()
