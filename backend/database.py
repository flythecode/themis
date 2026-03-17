import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Railway даёт postgres:// но SQLAlchemy хочет postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False) if DATABASE_URL else None
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency для FastAPI — выдаёт сессию БД."""
    if not async_session:
        raise RuntimeError("Database not configured")
    async with async_session() as session:
        yield session
