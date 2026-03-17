"""Phase 2: SQLAlchemy модели чатов."""
# from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
# from sqlalchemy.ext.declarative import declarative_base
#
# Base = declarative_base()
#
# class Chat(Base):
#     __tablename__ = "chats"
#     id = Column(String, primary_key=True)
#     user_tg_id = Column(String, ForeignKey("users.tg_id"), index=True)
#     mode = Column(String)  # analyze | generate | advise
#     country = Column(String)
#     lang = Column(String)
#     title = Column(String)
#     preview = Column(String)
#     msg_count = Column(Integer, default=0)
#     starred = Column(Boolean, default=False)
#     conv = Column(JSON)  # full conversation array
#     created_at = Column(DateTime)
#     updated_at = Column(DateTime)
