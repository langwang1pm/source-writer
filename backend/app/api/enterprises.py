from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_enterprise import ClientEnterprise
from app.schemas.client_enterprise import (
    EnterpriseCreate, EnterpriseUpdate, EnterpriseResponse, EnterpriseListResponse,
)

router = APIRouter(prefix="/api/v1/enterprises", tags=["Enterprises"])


@router.post("", response_model=EnterpriseResponse, status_code=201)
async def create_enterprise(body: EnterpriseCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientEnterprise).where(
            ClientEnterprise.name == body.name,
            ClientEnterprise.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(409, detail=f'Enterprise "{body.name}" already exists')
    ent = ClientEnterprise(name=body.name)
    db.add(ent)
    await db.commit()
    await db.refresh(ent)
    return ent


@router.get("", response_model=EnterpriseListResponse)
async def list_enterprises(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(ClientEnterprise).where(ClientEnterprise.deleted_at.is_(None))
    if search:
        q = q.where(ClientEnterprise.name.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(ClientEnterprise.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return EnterpriseListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
async def get_enterprise(enterprise_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientEnterprise).where(
            ClientEnterprise.id == enterprise_id,
            ClientEnterprise.deleted_at.is_(None),
        )
    )
    ent = result.scalar_one_or_none()
    if not ent:
        raise HTTPException(404, detail="Enterprise not found")
    return ent


@router.put("/{enterprise_id}", response_model=EnterpriseResponse)
async def update_enterprise(
    enterprise_id: UUID, body: EnterpriseUpdate, db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientEnterprise).where(
            ClientEnterprise.id == enterprise_id,
            ClientEnterprise.deleted_at.is_(None),
        )
    )
    ent = result.scalar_one_or_none()
    if not ent:
        raise HTTPException(404, detail="Enterprise not found")
    if body.name is not None:
        dup = await db.execute(
            select(ClientEnterprise).where(
                ClientEnterprise.name == body.name,
                ClientEnterprise.id != enterprise_id,
                ClientEnterprise.deleted_at.is_(None),
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(409, detail=f'Enterprise "{body.name}" already exists')
        ent.name = body.name
    await db.commit()
    await db.refresh(ent)
    return ent


@router.delete("/{enterprise_id}", status_code=204)
async def delete_enterprise(enterprise_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientEnterprise).where(
            ClientEnterprise.id == enterprise_id,
            ClientEnterprise.deleted_at.is_(None),
        )
    )
    ent = result.scalar_one_or_none()
    if not ent:
        raise HTTPException(404, detail="Enterprise not found")
    ent.deleted_at = datetime.now(timezone.utc)
    await db.commit()
