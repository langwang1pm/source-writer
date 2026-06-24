
from __future__ import annotations

import json
from typing import AsyncGenerator
from uuid import UUID

import markdown as md_lib
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.dify_chat_client import dify_chat_client
from app.models.chat_message import ChatMessage
from app.models.message_block import MessageBlock
from app.models.response_doc import ResponseDoc
from app.models.source_ref import SourceRef
from app.utils.citation_parser import parse_citations, clean_markdown, extract_title_from_content


class CardState:
    """Tracks a single card being assembled during SSE streaming."""

    def __init__(self, card_ordinal: int):
        self.card_ordinal = card_ordinal
        self.think_parts: list[str] = []
        self.answer_parts: list[str] = []
        self.global_ordinal = 0  # set externally

    def add_think(self, delta: str):
        self.think_parts.append(delta)

    def add_answer(self, delta: str):
        self.answer_parts.append(delta)

    @property
    def think_text(self) -> str:
        return "".join(self.think_parts)

    @property
    def answer_text(self) -> str:
        return "".join(self.answer_parts)

    def is_empty(self) -> bool:
        return not self.think_parts and not self.answer_parts


class StreamService:
    """Orchestrates the full SSE streaming flow."""

    def __init__(self, db: AsyncSession, session_id: UUID, user_message_id: UUID):
        self.db = db
        self.session_id = session_id
        self.user_message_id = user_message_id
        self.card_ordinal = 0
        self.global_ordinal = 0
        self.current_card: CardState | None = None
        self.all_blocks: list[MessageBlock] = []
        self._agent_buf: str = ""
        self._pending_refs: list[dict] | None = None
        self.all_source_refs: list[SourceRef] = []

    async def stream(self, query: str) -> AsyncGenerator[str, None]:
        """Main streaming loop. Yields SSE-formatted strings for the frontend."""
        # Fetch session context for Dify inputs
        from app.models.session import Session
        from app.models.workspace import Workspace
        sess = await self.db.get(Session, self.session_id)
        ttid = str(sess.task_type_id) if sess and sess.task_type_id else None
        eid = None
        if sess:
            ws = await self.db.get(Workspace, sess.workspace_id)
            if ws:
                eid = str(ws.client_enterprise_id)

        async for event in dify_chat_client.chat_stream(
            query=query,
            task_type_id=ttid,
            enterprise_id=eid,
        ):
            event_type = event.get("event", "")

            if event_type == "agent_thought":
                # Flush previous card before starting new one
                if self.current_card:
                    card_ord = self.current_card.card_ordinal if self.current_card else 0
                    card_ord = self.current_card.card_ordinal if self.current_card else 0
                    await self._flush_card()
                    if self._pending_refs:
                        yield self._sse("citation_update", {
                            "card_ordinal": card_ord,
                            "refs": self._pending_refs,
                        })
                        self._pending_refs = None
                self.card_ordinal += 1
                self.current_card = CardState(self.card_ordinal)
                self.current_card.global_ordinal = self.global_ordinal
                thought_delta = event.get("thought", "")
                if thought_delta:
                    self.current_card.add_think(thought_delta)
                    yield self._sse("think_delta", {
                        "card_ordinal": self.card_ordinal,
                        "delta": thought_delta,
                    })

            elif event_type == "agent_message" or event_type == "message":
                if self.current_card is None:
                    self.card_ordinal += 1
                    self.current_card = CardState(self.card_ordinal)
                    self.current_card.global_ordinal = self.global_ordinal
                answer_delta = event.get("answer", "")
                if answer_delta:
                    self._agent_buf += answer_delta
                    close_count = self._agent_buf.count("</think>")
                    if (close_count >= 1 and self.current_card and not self.current_card.is_empty()
                            and self._agent_buf.count("<think>") > close_count):
                        card_ord = self.current_card.card_ordinal if self.current_card else 0
                        await self._flush_card()
                        if self._pending_refs:
                            yield self._sse("citation_update", {
                                "card_ordinal": card_ord,
                                "refs": self._pending_refs,
                            })
                            self._pending_refs = None
                        self.card_ordinal += 1
                        self.current_card = CardState(self.card_ordinal)
                        self._agent_buf = answer_delta
                    self.current_card.add_answer(answer_delta)
                    yield self._sse("answer_delta", {
                        "card_ordinal": self.card_ordinal,
                        "delta": answer_delta,
                    })

            elif event_type == "message_end":
                if self.current_card:
                    await self._flush_card()
                # Build response doc from all cards
                try:
                    await self._on_message_end(event)
                except Exception as e:
                    import logging
                    logging.error("_on_message_end error: %s", e, exc_info=True)
                yield self._sse("done", {"status": "ok"})

            elif event_type == "error":
                yield self._sse("error", {"message": event.get("message", "Unknown error")})

            elif event_type == "ping":
                yield self._sse("ping", {})

            elif event_type == "warning":
                yield self._sse("warning", {"message": event.get("message", "")})

        # If Dify returned no message_end, finalize anyway
        if self.current_card:
            card_ord = self.current_card.card_ordinal if self.current_card else 0
            await self._flush_card()
            if self._pending_refs:
                yield self._sse("citation_update", {
                    "card_ordinal": card_ord,
                    "refs": self._pending_refs,
                })
                self._pending_refs = None
            yield self._sse("done", {"status": "ok"})

    async def _flush_card(self):
        """Write completed card to DB and send citation_update."""
        card = self.current_card
        if not card or card.is_empty():
            self.current_card = None
            return

        # Parse answer for embedded think tags
        if not card.think_text and card.answer_text and "<think>" in card.answer_text.lower():
            import re
            full = card.answer_text
            think_matches = list(re.finditer(r'<think>(.*?)</think>', full, re.DOTALL))

            if len(think_matches) > 1:
                # Handle text before the first <think> tag (would be lost otherwise)
                first_start = think_matches[0].start()
                if first_start > 0:
                    before_think = full[:first_start]
                    if before_think.strip():
                        citations = parse_citations(before_think, card.card_ordinal)
                        self.global_ordinal += 1
                        blk = MessageBlock(
                            session_id=self.session_id,
                            user_message_id=self.user_message_id,
                            card_ordinal=card.card_ordinal,
                            block_type="answer",
                            content=before_think,
                            ordinal=self.global_ordinal,
                        )
                        self.db.add(blk)
                        self.all_blocks.append(blk)
                        await self.db.flush()
                        for ref in citations:
                            sr = SourceRef(
                                response_doc_id=None,
                                message_block_id=blk.id,
                                card_ordinal=card.card_ordinal,
                                ordinal=ref["ordinal"],
                                source_name=ref["source_name"],
                                char_position=ref["char_position"],
                                dify_document_id=ref.get("dify_document_id"),
                                chunk_id=ref.get("chunk_id"),
                            )
                            self.db.add(sr)
                            self.all_source_refs.append(sr)

                for i, match in enumerate(think_matches):
                    think_content = match.group(1)
                    end_pos = match.end()
                    if i + 1 < len(think_matches):
                        next_start = think_matches[i + 1].start()
                        answer_between = full[end_pos:next_start]
                    else:
                        answer_between = full[end_pos:]
                    card_ordinal = card.card_ordinal + i

                    if think_content:
                        self.global_ordinal += 1
                        blk = MessageBlock(
                            session_id=self.session_id,
                            user_message_id=self.user_message_id,
                            card_ordinal=card_ordinal,
                            block_type="think",
                            content=think_content,
                            ordinal=self.global_ordinal,
                        )
                        self.db.add(blk)
                        self.all_blocks.append(blk)

                    if answer_between:
                        citations = parse_citations(answer_between, card_ordinal)
                        self.global_ordinal += 1
                        blk = MessageBlock(
                            session_id=self.session_id,
                            user_message_id=self.user_message_id,
                            card_ordinal=card_ordinal,
                            block_type="answer",
                            content=answer_between,
                            ordinal=self.global_ordinal,
                        )
                        self.db.add(blk)
                        self.all_blocks.append(blk)
                        await self.db.flush()
                        for ref in citations:
                            sr = SourceRef(
                                response_doc_id=None,
                                message_block_id=blk.id,
                                card_ordinal=card_ordinal,
                                ordinal=ref["ordinal"],
                                source_name=ref["source_name"],
                                char_position=ref["char_position"],
                                dify_document_id=ref.get("dify_document_id"),
                                chunk_id=ref.get("chunk_id"),
                            )
                            self.db.add(sr)
                            self.all_source_refs.append(sr)

                await self.db.flush()
                self.current_card = None
                return

            think_parts = []
            answer_parts = []
            pos = 0
            for match in think_matches:
                if match.start() > pos:
                    answer_parts.append(full[pos:match.start()])
                think_parts.append(match.group(1))
                pos = match.end()
            if pos < len(full):
                answer_parts.append(full[pos:])
            if think_parts:
                card.think_parts = think_parts
                card.answer_parts = answer_parts

        # Write think block
        if card.think_text:
            self.global_ordinal += 1
            blk = MessageBlock(
                session_id=self.session_id,
                user_message_id=self.user_message_id,
                card_ordinal=card.card_ordinal,
                block_type="think",
                content=card.think_text,
                ordinal=self.global_ordinal,
            )
            self.db.add(blk)
            self.all_blocks.append(blk)

        # Write answer block(s) - answer citations parsed before cleaning
        full_answer = card.answer_text
        if full_answer:
            citations = parse_citations(full_answer, card.card_ordinal)
            self.global_ordinal += 1
            blk = MessageBlock(
                session_id=self.session_id,
                user_message_id=self.user_message_id,
                card_ordinal=card.card_ordinal,
                block_type="answer",
                content=full_answer,
                ordinal=self.global_ordinal,
            )
            self.db.add(blk)
            self.all_blocks.append(blk)
            await self.db.flush()

            # Write source refs
            refs_data = []
            for ref in citations:
                sr = SourceRef(
                    response_doc_id=None,
                    message_block_id=blk.id,
                    card_ordinal=card.card_ordinal,
                    ordinal=ref["ordinal"],
                    source_name=ref["source_name"],
                    char_position=ref["char_position"],
                    dify_document_id=ref.get("dify_document_id"),
                    chunk_id=ref.get("chunk_id"),
                )
                self.db.add(sr)
                self.all_source_refs.append(sr)
                refs_data.append({
                    "ordinal": ref["ordinal"],
                    "source_name": ref["source_name"],
                    "char_position": ref["char_position"],
                    "dify_document_id": ref.get("dify_document_id"),
                    "chunk_id": ref.get("chunk_id"),
                })

            if refs_data:
                self._pending_refs = refs_data

        await self.db.flush()
        self.current_card = None

    async def _on_message_end(self, event: dict):
        """After SSE ends: create response_doc and link source_refs."""
        # Clean the full answer text
        all_raw = []
        for blk in self.all_blocks:
            if blk.block_type == "answer":
                all_raw.append(blk.content)
        full_answer = "\n".join(all_raw)
        clean_body = clean_markdown(full_answer)

        # Get session title from the message
        msg_result = await self.db.get(ChatMessage, self.user_message_id)
        title = msg_result.content[:30] if msg_result else "Untitled"

        # Create response doc
        body_html = md_lib.markdown(clean_body, extensions=["extra"])
        doc = ResponseDoc(
            session_id=self.session_id,
            chat_message_id=self.user_message_id,
            title=title,
            body_markdown=clean_body,
            body_html=body_html,
            revision=1,
        )
        self.db.add(doc)
        await self.db.flush()

        # Back-fill source_ref.response_doc_id
        for blk in self.all_blocks:
            for sr in self.all_source_refs:
                sr.response_doc_id = doc.id

        # Fetch Dify segment titles and update source_ref.source_name
        from app.clients.dify_dataset_client import dify_dataset_client
        for sr in self.all_source_refs:
            if sr.dify_document_id and sr.chunk_id:
                try:
                    detail = await dify_dataset_client.get_segment_detail(
                        sr.dify_document_id, sr.chunk_id
                    )
                    if detail:
                        title = extract_title_from_content(detail.get("content"))
                        if title:
                            sr.source_name = title
                except Exception:
                    pass  # Keep existing source_name on failure
        await self.db.commit()
        await self.db.refresh(doc)

    @staticmethod
    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def create_stream_service(
    db: AsyncSession, session_id: UUID, user_message_id: UUID
) -> StreamService:
    return StreamService(db=db, session_id=session_id, user_message_id=user_message_id)
