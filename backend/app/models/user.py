from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    role = Column(String, default="USER")  # USER | EXPERT | ADMIN
    preferred_language = Column(String, default="en")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
