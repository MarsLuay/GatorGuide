from typing import Optional, List
from model.schemas.school import School
from pydantic import BaseModel, Field
class AdvisorResponse(BaseModel):
    response: str = Field(description="Natural language advice to the student")
    schools: Optional[List[School]]