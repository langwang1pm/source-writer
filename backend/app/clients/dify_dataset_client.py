
from __future__ import annotations

import json

import httpx

from app.config import settings


class DifyDatasetClient:
    """Async client for Dify Dataset (Knowledge) API."""

    BASE_URL: str = settings.dify_base_url
    API_KEY: str = settings.dify_dataset_api_key or settings.dify_app_api_key
    DATASET_ID: str = settings.dify_dataset_id

    async def upload_file(
        self, file_path: str, file_name: str,
    ) -> dict | None:
        """Upload a file to Dify knowledge base. Returns the Dify document info."""
        if not self.BASE_URL or not self.DATASET_ID:
            return None

        url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/document/create-by-file"
        headers = {"Authorization": f"Bearer {self.API_KEY}"}

        timeout = httpx.Timeout(300.0, connect=10.0, read=300.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            with open(file_path, "rb") as f:
                files = {"file": (file_name, f, "application/octet-stream")}
                data = {
                    "indexing_technique": settings.dify_indexing_technique,
                    "process_rule_mode": settings.dify_process_rule_mode,
                    "doc_form": "hierarchical_model",
                }
                resp = await client.post(url, headers=headers, data=data, files=files)
            if resp.status_code != 200:
                return None
            result = resp.json()
            doc = result.get("document", {}) or {}
            return {
                "dify_document_id": doc.get("id", ""),
                "status": doc.get("indexing_status", "pending"),
            }

    async def set_metadata(
        self, dify_document_id: str, metadata: dict,
    ) -> bool:
        """Set metadata on a Dify document (e.g. company tag)."""
        if not self.BASE_URL or not self.DATASET_ID:
            return False
        url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/documents/{dify_document_id}/metadata"
        headers = {
            "Authorization": f"Bearer {self.API_KEY}",
            "Content-Type": "application/json",
        }
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=metadata)
            return resp.status_code == 200

    async def delete_document(self, dify_document_id: str) -> bool:
        """Delete a document from Dify knowledge base."""
        if not self.BASE_URL or not self.DATASET_ID:
            return False
        url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/documents/{dify_document_id}"
        headers = {"Authorization": f"Bearer {self.API_KEY}"}
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.delete(url, headers=headers)
            return resp.status_code == 200

    async def get_document_status(self, dify_document_id: str) -> str | None:
        """Get the indexing status of a document."""
        if not self.BASE_URL or not self.DATASET_ID:
            return None
        url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/documents/{dify_document_id}"
        headers = {"Authorization": f"Bearer {self.API_KEY}"}
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
            return data.get("indexing_status", "unknown")


dify_dataset_client = DifyDatasetClient()
