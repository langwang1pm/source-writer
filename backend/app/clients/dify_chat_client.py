
from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from app.config import settings


class DifyChatClient:
    """Async SSE client for Dify Chat API."""

    BASE_URL: str = settings.dify_base_url
    API_KEY: str = settings.dify_app_api_key

    CHAT_URL: str = f"{BASE_URL}/v1/chat-messages" if BASE_URL else ""

    async def chat_stream(
        self,
        query: str,
        user: str = "default",
        conversation_id: str | None = None,
    ) -> AsyncIterator[dict]:
        """Stream chat with Dify Agent API, yielding parsed SSE events."""
        if not self.CHAT_URL:
            yield {"event": "error", "message": "Dify not configured"}
            return

        payload = {
            "inputs": {},
            "query": query,
            "response_mode": "streaming",
            "user": user,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id

        headers = {
            "Authorization": f"Bearer {self.API_KEY}",
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(600.0, connect=10.0, read=600.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", self.CHAT_URL, json=payload, headers=headers
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    yield {
                        "event": "error",
                        "status": response.status_code,
                        "message": body.decode()[:500],
                    }
                    return

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            continue
                        try:
                            event = json.loads(data_str)
                            yield event
                        except json.JSONDecodeError:
                            continue


dify_chat_client = DifyChatClient()
