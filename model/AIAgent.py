import os
import json
import logging
import requests
from typing import Optional, List
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from openai import OpenAI
from advisorResponse import AdvisorResponse
from school import School
from studentIntent import StudentIntent
# --------------------------------------------------------------
# Setup
# --------------------------------------------------------------

load_dotenv()

# Set up logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-5-nano"

COLLEGE_SCORECARD_API_KEY = os.getenv("COLLEGE_SCORECARD_API_KEY")
COLLEGE_SCORECARD_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"

# --------------------------------------------------------------
# Step 2: Defines functions
# --------------------------------------------------------------

def search_colleges(
    school_name: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 3,
):
    """set up calling to college Scorecard API, extract school info"""
    logger.info("Calling College Scorecard API")

    params = {
        "api_key": COLLEGE_SCORECARD_API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
            "latest.admissions.admission_rate.overall,"
            "latest.cost.tuition.in_state,"
            "latest.cost.tuition.out_of_state"
        ),
        "per_page": limit,
    }

    if school_name:
        params["school.name"] = school_name
    if state:
        params["school.state"] = state

    res = requests.get(COLLEGE_SCORECARD_URL, params=params)
    res.raise_for_status()

    results = []
    for s in res.json()["results"]:
        results.append(
            {
                "name": s.get("school.name"),
                "city": s.get("school.city"),
                "state": s.get("school.state"),
                "acceptance_rate": s.get("latest.admissions.admission_rate.overall"),
                "tuition_in_state": s.get("latest.cost.tuition.in_state"),
                "tuition_out_state": s.get("latest.cost.tuition.out_of_state"),
            }
        )
    return results

def state_search_colleges(
    state: str,
    school_name: Optional[str] = None,
    acceptance_rate_range: Optional[str] = None,
    in_state_tuition_range: Optional[str] = None,
    sat_score_range: Optional[str] = None,
    limit: int = 5,
):
    """set up calling to college Scorecard API, extract schools's info in a state"""
    params = {
        "api_key": COLLEGE_SCORECARD_API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
            "latest.admissions.admission_rate.overall,"
            "latest.admissions.sat_scores.average.overall,"
            "latest.cost.tuition.in_state,"
            "latest.earnings.6_yrs_after_entry.median"
        ),
        "school.state": state,
        "per_page": limit,
    }

    if school_name:
        params["school.name"] = school_name

    if acceptance_rate_range:
        params["latest.admissions.admission_rate.overall__range"] = acceptance_rate_range

    if in_state_tuition_range:
        params["latest.cost.tuition.in_state__range"] = in_state_tuition_range

    if sat_score_range:
        params["latest.admissions.sat_scores.average.overall__range"] = sat_score_range

    response = requests.get(COLLEGE_SCORECARD_URL, params=params)
    response.raise_for_status()
    return response.json()["results"]

# --------------------------------------------------------------
# Step 3: Tool Schema (FOR THE MODEL)
# --------------------------------------------------------------

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_colleges",
            "description": "Search colleges using official College Scorecard data",
            "parameters": {
                "type": "object",
                "properties": {
                    "school_name": {"type": "string"},
                    "state": {"type": "string"},
                    "limit": {"type": "integer", "default": 3},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "state_search_colleges",
            "description": (
                "Search for colleges within a U.S. state. "
                "You may optionally filter by acceptance rate, tuition, "
                "or SAT score using range strings like '0.3..0.7'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "state": {
                        "type": "string",
                        "description": "Two-letter U.S. state code (e.g. WA, CA)"
                    },
                    "school_name": {
                        "type": "string",
                        "description": "Optional school name filter"
                    },
                    "acceptance_rate_range": {
                        "type": "string",
                        "description": (
                            "Acceptance rate range using min..max format "
                            "(example: '0.3..0.6')"
                        )
                    },
                    "in_state_tuition_range": {
                        "type": "string",
                        "description": (
                            "In-state tuition range in USD using min..max "
                            "(example: '8000..20000')"
                        )
                    },
                    "sat_score_range": {
                        "type": "string",
                        "description": (
                            "Average SAT score range using min..max "
                            "(example: '1200..1400')"
                        )
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5
                    }
                },
                "required": ["state"]
            }
        }
    }
]

# --------------------------------------------------------------
# Step 4: Intent Extraction (LLM → Pydantic)
# --------------------------------------------------------------

def extract_student_intent(user_input: str) -> StudentIntent:
    """First LLM call to determine if input is a student intention for college advising"""
    completion = client.beta.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract the student's intent for college advising. "
                    "Identify intent, school name, and state if present."
                ),
            },
            {"role": "user", "content": user_input},
        ],
        response_format=StudentIntent,
    )
    result = completion.choices[0].message.parsed
    logger.info(
        f"Extraction complete - Confidence: {result.confidence_score:.2f}"
    )
    return result


# --------------------------------------------------------------
# Step 5: Advisor Agent (TOOL + DATA MODELS)
# --------------------------------------------------------------

def run_advisor_agent(user_input: str) -> Optional[AdvisorResponse]:
    intent = extract_student_intent(user_input)

    if(intent.confidence_score < 0.7):
        logger.warning(
            f"Gate check failed, confidence: {intent.confidence_score:.2f}"
        )
        return None

    logger.info("Gate check passed, proceeding with advising processing")
    messages = [
        {
            "role": "system",
            "content": (
                "You are a knowledgeable college advisor. "
                "Use College Scorecard data when helpful."
            ),
        },
        {"role": "user", "content": user_input},
    ]

    # -----------------------------------
    # Ask model (tool-aware)
    # -----------------------------------
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=tools,
    )

    assistant_msg = response.choices[0].message

    # -----------------------------------
    # Tool call handling
    # -----------------------------------
    if assistant_msg.tool_calls:
        messages.append(assistant_msg)

        for tool_call in assistant_msg.tool_calls:
            tool_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            if tool_name == "state_search_colleges":
                tool_result = state_search_colleges(**args)

            elif tool_name == "search_colleges":
                tool_result = search_colleges(**args)

            else:
                raise ValueError(f"Unknown tool called: {tool_name}")

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                }
            )

        final = client.beta.chat.completions.parse(
            model=MODEL,
            messages=messages,
            response_format=AdvisorResponse,
        )

        return final.choices[0].message.parsed

    # -----------------------------------
    # No tool needed
    # -----------------------------------
    final = client.beta.chat.completions.parse(
        model=MODEL,
        messages=messages + [assistant_msg],
        response_format=AdvisorResponse,
    )

    return final.choices[0].message.parsed


# --------------------------------------------------------------
# Step 6: CLI Chat
# --------------------------------------------------------------

if __name__ == "__main__":
    print("🎓 College Advisor AI")
    print("Type 'exit' to quit\n")

    while True:
        user_input = input("Student: ")
        if user_input.lower() == "exit":
            break

        result = run_advisor_agent(user_input)

        print("\nAdvisor:", result.response)

        if result.schools:
            print("\n📚 Schools:")
            for s in result.schools:
                print(
                    f"- {s.name} ({s.city}, {s.state}) | "
                    f"Acceptance: {s.acceptance_rate or 'N/A'}"
                )
        print()