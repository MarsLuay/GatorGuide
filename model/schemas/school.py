from typing import Optional, Dict, Any
from pydantic import BaseModel

class Weather(BaseModel):
    temperature_celsius: Optional[float] = None
    wind_speed_kmh: Optional[float] = None

class School(BaseModel):
    name: str
    city: str
    state: str
    acceptance_rate: Optional[float] = None
    tuition_in_state: Optional[int] = None
    tuition_out_of_state: Optional[int] = None
    weather: Optional[Weather] = None