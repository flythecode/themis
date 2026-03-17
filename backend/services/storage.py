"""
Phase 2: DB абстракция.
Пока заглушки — при подключении PostgreSQL заменить на SQLAlchemy запросы.
"""


async def get_user(tg_id: str) -> dict | None:
    # TODO: Phase 2
    return None


async def create_user(tg_id: str, data: dict) -> dict:
    # TODO: Phase 2
    return {"tg_id": tg_id, **data}


async def set_pro(tg_id: str, days: int, source: str) -> bool:
    # TODO: Phase 2
    return True


async def get_usage(tg_id: str) -> dict:
    # TODO: Phase 2
    return {"count": 0, "limit": 10}
