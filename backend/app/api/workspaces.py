from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.workspace import Workspace
from app.models.client_enterprise import ClientEnterprise
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspaceListResponse,
)

router = APIRouter(prefix="/api/v1/workspaces", tags=["Workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    ent = await db.get(ClientEnterprise, body.client_enterprise_id)
    if not ent or ent.deleted_at is not None:
        raise HTTPException(404, detail="Enterprise not found")
    ws = Workspace(name=body.name, client_enterprise_id=body.client_enterprise_id)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    resp = WorkspaceResponse.model_validate(ws)
    resp.client_enterprise_name = ent.name
    return resp


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    enterprise_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Workspace).where(Workspace.deleted_at.is_(None))
    if enterprise_id:
        q = q.where(Workspace.client_enterprise_id == enterprise_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.options(joinedload(Workspace.client_enterprise))
        .order_by(Workspace.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.unique().scalars().all()
    resp_items = []
    for ws in items:
        r = WorkspaceResponse.model_validate(ws)
        r.client_enterprise_name = ws.client_enterprise.name if ws.client_enterprise else None
        r.client_enterprise_deleted = ws.client_enterprise.deleted_at is not None if ws.client_enterprise else False
        resp_items.append(r)
    return WorkspaceListResponse(
    items=resp_items, total=total, page=page, page_size=page_size,
    total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workspace)
        .options(joinedload(Workspace.client_enterprise))
        .where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.unique().scalar_one_or_none()
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    r = WorkspaceResponse.model_validate(ws)
    r.client_enterprise_name = ws.client_enterprise.name if ws.client_enterprise else None
    r.client_enterprise_deleted = ws.client_enterprise.deleted_at is not None if ws.client_enterprise else False
    return r


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID, body: WorkspaceUpdate, db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workspace)
        .options(joinedload(Workspace.client_enterprise))
        .where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.unique().scalar_one_or_none()
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    if body.name is not None:
        ws.name = body.name
    await db.commit()
    await db.refresh(ws)
    r = WorkspaceResponse.model_validate(ws)
    r.client_enterprise_name = ws.client_enterprise.name if ws.client_enterprise else None
    r.client_enterprise_deleted = ws.client_enterprise.deleted_at is not None if ws.client_enterprise else False
    return r


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.deleted_at.is_(None),
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    ws.deleted_at = datetime.now(timezone.utc)
    await db.commit()
