from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task_type import TaskType
from app.schemas.task_type import (
    TaskTypeCreate, TaskTypeUpdate, TaskTypeResponse, TaskTypeListResponse,
)

router = APIRouter(prefix="/api/v1/task-types", tags=["Task Types"])


@router.post("", response_model=TaskTypeResponse, status_code=201)
async def create_task_type(body: TaskTypeCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskType).where(
            TaskType.name == body.name,
            TaskType.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(409, detail=f'Task type "{body.name}" already exists')
    tt = TaskType(name=body.name, description=body.description)
    db.add(tt)
    await db.commit()
    await db.refresh(tt)
    return tt


@router.get("", response_model=TaskTypeListResponse)
async def list_task_types(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    q = select(TaskType).where(TaskType.deleted_at.is_(None))
    if active_only:
        q = q.where(TaskType.is_active.is_(True))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        q.order_by(TaskType.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    return TaskTypeListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{task_type_id}", response_model=TaskTypeResponse)
async def get_task_type(task_type_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskType).where(
            TaskType.id == task_type_id,
            TaskType.deleted_at.is_(None),
        )
    )
    tt = result.scalar_one_or_none()
    if not tt:
        raise HTTPException(404, detail="Task type not found")
    return tt


@router.put("/{task_type_id}", response_model=TaskTypeResponse)
async def update_task_type(
    task_type_id: UUID, body: TaskTypeUpdate, db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TaskType).where(
            TaskType.id == task_type_id,
            TaskType.deleted_at.is_(None),
        )
    )
    tt = result.scalar_one_or_none()
    if not tt:
        raise HTTPException(404, detail="Task type not found")
    if body.name is not None:
        dup = await db.execute(
            select(TaskType).where(
                TaskType.name == body.name,
                TaskType.id != task_type_id,
                TaskType.deleted_at.is_(None),
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(409, detail=f'Task type "{body.name}" already exists')
        tt.name = body.name
    if body.description is not None:
        tt.description = body.description
    if body.is_active is not None:
        tt.is_active = body.is_active
    await db.commit()
    await db.refresh(tt)
    return tt


@router.delete("/{task_type_id}", status_code=204)
async def delete_task_type(task_type_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskType).where(
            TaskType.id == task_type_id,
            TaskType.deleted_at.is_(None),
        )
    )
    tt = result.scalar_one_or_none()
    if not tt:
        raise HTTPException(404, detail="Task type not found")
    tt.deleted_at = datetime.now(timezone.utc)
    await db.commit()
