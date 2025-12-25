# api.py
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
    student_input: str

@app.post("/advisor")
def advisor_endpoint(request: AdvisorRequest):
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
                "acceptance_rate": s.acceptance_rate
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
