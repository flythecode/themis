"""Phase 2: SQLAlchemy модели пользователей."""
# from sqlalchemy import Column, String, Boolean, DateTime, Integer
# from sqlalchemy.ext.declarative import declarative_base
#
# Base = declarative_base()
#
# class User(Base):
#     __tablename__ = "users"
#     id = Column(Integer, primary_key=True)
#     tg_id = Column(String, unique=True, index=True)
#     is_pro = Column(Boolean, default=False)
#     pro_until = Column(DateTime, nullable=True)
#     country = Column(String, default="Черногория")
#     lang = Column(String, default="ru")
#     created_at = Column(DateTime)
