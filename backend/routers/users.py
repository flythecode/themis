from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ActivateProRequest(BaseModel):
    days: int = 30
    source: str = "telegram_stars"


@router.get("/{tg_id}/status")
async def get_user_status(tg_id: str):
    """Phase 2: проверка Pro-статуса пользователя из БД."""
    # TODO: Phase 2 — проверка в PostgreSQL
    return {"is_pro": False, "requests_left": 10}


@router.post("/{tg_id}/activate-pro")
async def activate_pro(tg_id: str, req: ActivateProRequest):
    """Phase 2: активация Pro подписки."""
    # TODO: Phase 2 — запись в PostgreSQL
    return {"status": "ok", "tg_id": tg_id, "days": req.days}
