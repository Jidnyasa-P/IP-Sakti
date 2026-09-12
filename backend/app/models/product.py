from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime, timezone
from app.database.session import Base


class ProductAnalysis(Base):
    __tablename__ = "product_analyses"

    id = Column(String, primary_key=True)
    user_id = Column(String, default="user-default")
    product_information = Column(JSON)
    likely_category = Column(String)
    category_reasoning = Column(String)
    confidence = Column(JSON)
    regulatory_considerations = Column(JSON)
    ipr_considerations = Column(JSON)
    traditional_knowledge_abs_flags = Column(JSON)
    recommended_next_steps = Column(JSON)
    evidence = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
