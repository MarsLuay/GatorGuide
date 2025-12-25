from typing import Optional
from pydantic import BaseModel, Field
class StudentIntent(BaseModel):
    """Detect whether the student is asking about colleges"""
    intent: str = Field(description="Intent such as 'school_search', 'comparison', or 'general_advice'")
    school_name: Optional[str] = Field(description="School name if mentioned")
    state: Optional[str] = Field(description="US state if mentioned")
    confidence_score: float = Field(description="Confidence score 0-1")