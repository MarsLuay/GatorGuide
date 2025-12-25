from typing import Optional
from pydantic import BaseModel
class School(BaseModel):
    name: str
    city: str
    state: str
    acceptance_rate: Optional[float]
    tuition_in_state: Optional[int]
    tuition_out_state: Optional[int]