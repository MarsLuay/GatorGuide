from typing import Optional
from pydantic import BaseModel, Field

class StudentIntent(BaseModel):
    """Detect whether the student is asking about colleges"""
    intent: str = Field(
        description="Intent type: 'school_search', 'comparison', 'general_advice', 'requirements', or 'off_topic'"
    )
    school_name: Optional[str] = Field(
        default=None,
        description="Full school name if mentioned (expand abbreviations like UWash → University of Washington)"
    )
    state: Optional[str] = Field(
        default=None,
        description="Two-letter US state code if mentioned (e.g., WA, CA, TX)"
    )
    confidence_score: float = Field(
        description="Confidence 0-1: >0.7 for explicit college queries, 0.5-0.7 for implicit, <0.5 for off-topic"
    )