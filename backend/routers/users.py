from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from database import get_db
from models.user import User

router = APIRouter()


class ActivateProRequest(BaseModel):
    days: int = 30
    source: str = "telegram_stars"


class UserCreateRequest(BaseModel):
    tg_id: str
    first_name: str = ""
    last_name: str = ""
    country: str = "Черногория"
    lang: str = "ru"


@router.get("/{tg_id}/status")
async def get_user_status(tg_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"is_pro": False, "requests_left": 10}

    now = datetime.now(timezone.utc)
    is_pro = user.is_pro and user.pro_until and user.pro_until > now
    return {
        "is_pro": is_pro,
        "requests_left": 1000 if is_pro else 10,
        "pro_until": user.pro_until.isoformat() if user.pro_until else None,
        "country": user.country,
        "lang": user.lang,
    }


@router.post("/{tg_id}/activate-pro")
async def activate_pro(tg_id: str, req: ActivateProRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    pro_until = now + timedelta(days=req.days)

    if not user:
        user = User(tg_id=tg_id, is_pro=True, pro_until=pro_until)
        db.add(user)
    else:
        # Если уже Pro — продлеваем от текущей даты окончания
        if user.pro_until and user.pro_until > now:
            pro_until = user.pro_until + timedelta(days=req.days)
        user.is_pro = True
        user.pro_until = pro_until

    await db.commit()
    return {"status": "ok", "tg_id": tg_id, "pro_until": pro_until.isoformat()}


@router.post("/sync")
async def sync_user(req: UserCreateRequest, db: AsyncSession = Depends(get_db)):
    """Создать/обновить пользователя при входе в Mini App."""
    result = await db.execute(select(User).where(User.tg_id == req.tg_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            tg_id=req.tg_id,
            first_name=req.first_name,
            last_name=req.last_name,
            country=req.country,
            lang=req.lang,
        )
        db.add(user)
    else:
        user.first_name = req.first_name
        user.last_name = req.last_name
        user.country = req.country
        user.lang = req.lang
        user.updated_at = datetime.now(timezone.utc)

    await db.commit()

    now = datetime.now(timezone.utc)
    is_pro = user.is_pro and user.pro_until and user.pro_until > now
    return {
        "tg_id": user.tg_id,
        "is_pro": is_pro,
        "pro_until": user.pro_until.isoformat() if user.pro_until else None,
        "country": user.country,
        "lang": user.lang,
    }
