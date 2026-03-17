from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, BigInteger, ForeignKey
from datetime import datetime, timezone
from database import Base


class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True)
    user_tg_id = Column(String, ForeignKey("users.tg_id"), index=True, nullable=False)
    mode = Column(String, nullable=False)  # analyze | generate | advise
    country = Column(String, default="")
    lang = Column(String, default="ru")
    title = Column(String, default="")
    preview = Column(String, default="")
    msg_count = Column(Integer, default=0)
    starred = Column(Boolean, default=False)
    conv = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
