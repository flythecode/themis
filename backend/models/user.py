from sqlalchemy import Column, String, Boolean, DateTime, BigInteger
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tg_id = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    country = Column(String, default="Черногория")
    lang = Column(String, default="ru")
    is_pro = Column(Boolean, default=False)
    pro_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
