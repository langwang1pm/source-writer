
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

        # Config must be sent as a JSON string in the 'data' form field
        data_config = {
            "indexing_technique": settings.dify_indexing_technique,
            "doc_form": settings.dify_doc_form,
            "doc_language": "Chinese Simplified",
            "process_rule": {
                "mode": settings.dify_process_rule_mode,
                "rules": {
                    "pre_processing_rules": [
                        {"id": "remove_extra_spaces", "enabled": True},
                        {"id": "remove_urls_emails", "enabled": False},
                    ],
                    "segmentation": {
                        "separator": "\n\n",
                        "max_tokens": 1024,
                    },
                    "parent_mode": "paragraph",
                    "subchunk_segmentation": {
                        "separator": "\n",
                        "max_tokens": 512,
                    },
                },
            },
            "retrieval_model": {
                "search_method": "hybrid_search",
                "reranking_enable": settings.dify_reranking_enable,
                "reranking_mode": "weighted_score",
                "reranking_model": {"reranking_provider_name": "", "reranking_model_name": ""},
                "weights": {
                    "weight_type": "customized",
                    "keyword_setting": {"keyword_weight": 0.3},
                    "vector_setting": {"vector_weight": 0.7, "embedding_model_name": "", "embedding_provider_name": ""},
                },
                "top_k": 5,
                "score_threshold_enabled": True,
                "score_threshold": settings.dify_score_threshold,
            },
            "embedding_model": settings.dify_embedding_model,
            "embedding_model_provider": settings.dify_embedding_model_provider,
        }

        timeout = httpx.Timeout(600.0, connect=30.0, read=600.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            with open(file_path, "rb") as f:
                files = {"file": (file_name, f, "application/octet-stream")}
                form_data = {"data": json.dumps(data_config)}
                resp = await client.post(url, headers=headers, data=form_data, files=files)
            if resp.status_code != 200:
                return None
            result = resp.json()
            doc = result.get("document", {}) or {}
            return {
                "dify_document_id": doc.get("id", ""),
                "status": doc.get("indexing_status", "pending"),
            }

    async def set_metadata(
        self, dify_document_id: str, enterprise_id: str,
    ) -> bool:
        """Set company metadata on a Dify document using the Dify batch metadata API."""
        if not self.BASE_URL or not self.DATASET_ID:
            return False
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Step 1: Get the metadata field ID for "company"
            meta_url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/metadata"
            headers = {"Authorization": f"Bearer {self.API_KEY}"}
            resp = await client.get(meta_url, headers=headers)
            if resp.status_code != 200:
                return False
            meta_list = resp.json().get("doc_metadata", [])
            field_id = None
            for m in meta_list:
                if m.get("name") == "company":
                    field_id = m.get("id")
                    break
            if not field_id:
                return False

            # Step 2: Set metadata on the document
            set_url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/documents/metadata"
            payload = {
                "operation_data": [
                    {
                        "document_id": dify_document_id,
                        "metadata_list": [
                            {"id": field_id, "name": "company", "value": enterprise_id}
                        ],
                    }
                ]
            }
            resp2 = await client.post(set_url, headers=headers, json=payload)
            return resp2.status_code in (200, 201)

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


        """Fetch a specific segment (chunk) detail from Dify knowledge base.

        Uses the Dify API: GET /v1/datasets/{dataset_id}/documents/{document_id}/segments/{segment_id}
        Returns the segment data dict, or None on failure.
        """
        if not self.BASE_URL or not self.DATASET_ID:
            return None
        url = f"{self.BASE_URL}/v1/datasets/{self.DATASET_ID}/documents/{document_id}/segments/{chunk_id}"
        headers = {"Authorization": f"Bearer {self.API_KEY}"}
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
            return data.get("data") or data


dify_dataset_client = DifyDatasetClient()
