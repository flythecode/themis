from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timezone
from database import get_db
from models.chat import Chat
from typing import Optional

router = APIRouter()


class ChatSaveRequest(BaseModel):
    id: str
    user_tg_id: str
    mode: str
    country: str = ""
    lang: str = "ru"
    title: str = ""
    preview: str = ""
    msg_count: int = 0
    starred: bool = False
    conv: list = []


@router.get("/{tg_id}")
async def get_chats(tg_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chat)
        .where(Chat.user_tg_id == tg_id)
        .order_by(Chat.updated_at.desc())
        .limit(60)
    )
    chats = result.scalars().all()
    return [
        {
            "id": c.id,
            "mode": c.mode,
            "country": c.country,
            "lang": c.lang,
            "title": c.title,
            "preview": c.preview,
            "msgCount": c.msg_count,
            "starred": c.starred,
            "conv": c.conv,
            "date": c.updated_at.timestamp() * 1000,
        }
        for c in chats
    ]


@router.post("/save")
async def save_chat(req: ChatSaveRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chat).where(Chat.id == req.id))
    chat = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not chat:
        chat = Chat(
            id=req.id,
            user_tg_id=req.user_tg_id,
            mode=req.mode,
            country=req.country,
            lang=req.lang,
            title=req.title,
            preview=req.preview,
            msg_count=req.msg_count,
            starred=req.starred,
            conv=req.conv,
            created_at=now,
            updated_at=now,
        )
        db.add(chat)
    else:
        chat.title = req.title
        chat.preview = req.preview
        chat.msg_count = req.msg_count
        chat.starred = req.starred
        chat.conv = req.conv
        chat.updated_at = now

    await db.commit()
    return {"status": "ok", "id": chat.id}


@router.delete("/{tg_id}/{chat_id}")
async def delete_chat(tg_id: str, chat_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(Chat).where((Chat.id == chat_id) & (Chat.user_tg_id == tg_id))
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/{tg_id}/{chat_id}/star")
async def toggle_star(tg_id: str, chat_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chat).where((Chat.id == chat_id) & (Chat.user_tg_id == tg_id))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        return {"status": "not_found"}
    chat.starred = not chat.starred
    await db.commit()
    return {"status": "ok", "starred": chat.starred}
