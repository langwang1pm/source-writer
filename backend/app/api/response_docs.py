
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.response_doc import ResponseDoc
import urllib.parse
from app.schemas.response_doc import (
    ResponseDocResponse, ResponseDocUpdate, ResponseDocListResponse,
)

router = APIRouter(prefix="/api/v1/response-docs", tags=["Response Docs"])


@router.get("", response_model=ResponseDocListResponse)
async def list_response_docs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(ResponseDoc).where(ResponseDoc.deleted_at.is_(None))
    if session_id:
        q = q.where(ResponseDoc.session_id == session_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(ResponseDoc.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return ResponseDocListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{doc_id}", response_model=ResponseDocResponse)
async def get_response_doc(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    return doc


@router.put("/{doc_id}", response_model=ResponseDocResponse)
async def update_response_doc(
    doc_id: UUID,
    body: ResponseDocUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    import markdown
    if body.title is not None:
        doc.title = body.title
    if body.body_markdown is not None:
        doc.body_markdown = body.body_markdown
        doc.body_html = markdown.markdown(body.body_markdown, extensions=["extra"])
    doc.revision += 1
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{doc_id}/export")
async def export_docx(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResponseDoc).where(
            ResponseDoc.id == doc_id,
            ResponseDoc.deleted_at.is_(None),
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, detail="Document not found")
    from fastapi.responses import StreamingResponse
    docx_buf = _markdown_to_docx(doc.body_markdown or "", doc.title or "export")
    safe_name = urllib.parse.quote(f"{doc.title or 'export'}.docx", safe='')
    return StreamingResponse(
        docx_buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}"},
    )
    
    
def _markdown_to_docx(markdown_text: str, title: str):
    """Convert markdown text to a DOCX bytes buffer using pure Python (no external deps).
    
    DOCX is a ZIP file containing XML. We build a minimal valid DOCX
    with the markdown rendered as styled paragraphs.
    """
    import io, zipfile, xml.sax.saxutils as saxutils
    from datetime import datetime
    
    esc = saxutils.escape
    lines = markdown_text.split('\n')
    body_parts = []
    body_parts.append('<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">')
    body_parts.append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>')
    
    # Title as heading 1
    body_parts.append(_docx_heading(esc(title), 1))
    
    for line in markdown_text.split('\n'):
        s = line.strip()
        if not s:
            body_parts.append('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>')
        elif s == '---':
            body_parts.append('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>')
        elif s.startswith('### '):
            body_parts.append(_docx_heading(esc(s[4:]), 3))
        elif s.startswith('## '):
            body_parts.append(_docx_heading(esc(s[3:]), 2))
        elif s.startswith('# '):
            body_parts.append(_docx_heading(esc(s[2:]), 1))
        else:
            body_parts.append(_docx_paragraph(esc(s)))
    
    body_parts.append('</w:body>')
    document_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + ''.join(body_parts)
    
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>'
    )
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
    )
    
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/_rels/document.xml.rels', doc_rels)
        z.writestr('word/document.xml', document_xml)
    buf.seek(0)
    return buf
    
    
def _docx_paragraph(text: str) -> str:
    return (
        '<w:p><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="21"/></w:rPr>'
        '<w:t xml:space="preserve">' + text + '</w:t></w:r></w:p>'
    )
    
    
def _docx_heading(text: str, level: int) -> str:
    sz = {1: 32, 2: 26, 3: 22}.get(level, 21)
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading' + str(level) + '"/><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="' + str(sz) + '"/></w:rPr>'
        '<w:t>' + text + '</w:t></w:r></w:p>'
    )
