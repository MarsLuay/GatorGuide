# api.py
"""
FastAPI backend for GatorGuide college advisor.

Exposes REST endpoints for the Streamlit frontend to interact with the
advisor agent system. Handles student queries, invokes the agent, and
returns structured college recommendations with comprehensive data.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from model.agent.advisoragent import run_advisor_agent
import logging
import uvicorn

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="College Advisor API")

# Request model
class AdvisorRequest(BaseModel):
    """
    Request body for the advisor endpoint.
    
    Attributes:
        student_input (str): Natural language query from student about colleges
        
    Example:
        {"student_input": "Show me competitive schools in California"}
    """
    student_input: str


@app.post("/advisor")
def advisor_endpoint(request: AdvisorRequest):
    """
    Main advisor endpoint for college recommendations.
    
    Receives a student query, invokes the advisor agent to process it,
    and returns a structured response with recommended schools and their data.
    
    Args:
        request (AdvisorRequest): Contains student_input query string
        
    Returns:
        dict: {
            "response": str - Natural language advice from advisor,
            "schools": list - Recommended School objects with full data
        }
        
    Raises:
        HTTPException: 500 if agent processing fails
        
    Example:
        Request: {"student_input": "Show me MIT"}
        Response: {
            "response": "MIT is one of the world's...",
            "schools": [{
                "name": "MIT",
                "state": "MA",
                "acceptance_rate": 0.034,
                "tuition_in_state": 62154,
                ...
            }]
        }
    """
    logger.info(f"Received input: {request.student_input}")
    try:
        result = run_advisor_agent(request.student_input)
        if not result:
            logger.warning("No advisor response generated.")
            return {"response": "Sorry, I couldn't understand your query.", "schools": []}

        # Format schools nicely
        schools = [
            {
                "name": s.name,
                "city": s.city,
                "state": s.state,
                "acceptance_rate": s.acceptance_rate,
                "tuition_in_state": getattr(s, "tuition_in_state", None),
                "tuition_out_of_state": getattr(s, "tuition_out_of_state", None),
                "weather": s.weather.dict() if s.weather else None,
            }
            for s in getattr(result, "schools", []) or []
        ]
        return {"response": result.response, "schools": schools}

    except Exception as e:
        logger.error(f"Error in advisor endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# At the end of api.py
if __name__ == "__main__":
    uvicorn.run("model.api:app", host="127.0.0.1", port=8000, reload=True)
