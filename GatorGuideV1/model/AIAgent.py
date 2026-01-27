import os
import json
import logging
import requests
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI

from model.schemas.advisorResponse import AdvisorResponse
from model.schemas.studentIntent import StudentIntent

# --------------------------------------------------------------
# Setup
# --------------------------------------------------------------

load_dotenv()

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
# Tool Functions
# --------------------------------------------------------------

def search_colleges(
    school_name: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 3,
):
    logger.info("🔧 Tool: search_colleges called")
    logger.info(f"Arguments: school_name={school_name}, state={state}, limit={limit}")

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

    logger.info("🌐 Calling College Scorecard API")
    response = requests.get(COLLEGE_SCORECARD_URL, params=params)
    response.raise_for_status()

    results = []
    for s in response.json()["results"]:
        results.append(
            {
                "name": s.get("school.name"),
                "city": s.get("school.city"),
                "state": s.get("school.state"),
                "acceptance_rate": s.get(
                    "latest.admissions.admission_rate.overall"
                ),
                "tuition_in_state": s.get(
                    "latest.cost.tuition.in_state"
                ),
                "tuition_out_state": s.get(
                    "latest.cost.tuition.out_of_state"
                ),
            }
        )

    logger.info(f"✅ Tool returned {len(results)} schools")
    return results


def state_search_colleges(
    state: str,
    school_name: Optional[str] = None,
    acceptance_rate_range: Optional[str] = None,
    in_state_tuition_range: Optional[str] = None,
    sat_score_range: Optional[str] = None,
    limit: int = 5,
):
    logger.info("🔧 Tool: state_search_colleges called")
    logger.info(
        f"Arguments: state={state}, acceptance={acceptance_rate_range}, "
        f"tuition={in_state_tuition_range}, SAT={sat_score_range}"
    )

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

    logger.info("🌐 Calling College Scorecard API")
    response = requests.get(COLLEGE_SCORECARD_URL, params=params)
    response.raise_for_status()

    results = response.json()["results"]
    logger.info(f"✅ Tool returned {len(results)} schools")
    return results


# --------------------------------------------------------------
# Tool Schema
# --------------------------------------------------------------

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_colleges",
            "description": "Search colleges using College Scorecard data",
            "parameters": {
                "type": "object",
                "properties": {
                    "school_name": {"type": "string"},
                    "state": {"type": "string"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "state_search_colleges",
            "description": "Search colleges in a specific U.S. state",
            "parameters": {
                "type": "object",
                "properties": {
                    "state": {"type": "string"},
                    "school_name": {"type": "string"},
                    "acceptance_rate_range": {"type": "string"},
                    "in_state_tuition_range": {"type": "string"},
                    "sat_score_range": {"type": "string"},
                    "limit": {"type": "integer"},
                },
                "required": ["state"],
            },
        },
    },
]

# --------------------------------------------------------------
# tools executor
# --------------------------------------------------------------

def execute_tool(tool_name: str, args: dict):
    """
    Centralized tool dispatcher for OpenAI function calls
    """
    logger.info(f"🛠 Executing tool: {tool_name}")
    logger.debug(f"Tool arguments: {args}")

    TOOL_REGISTRY = {
        "search_colleges": search_colleges,
        "state_search_colleges": state_search_colleges,
    }

    if tool_name not in TOOL_REGISTRY:
        logger.error(f"❌ Unknown tool requested: {tool_name}")
        raise ValueError(f"Unknown tool: {tool_name}")

    result = TOOL_REGISTRY[tool_name](**args)

    logger.info(f"✅ Tool {tool_name} executed successfully")
    return result

# --------------------------------------------------------------
# Intent Extraction
# --------------------------------------------------------------

def extract_student_intent(user_input: str) -> StudentIntent:
    logger.info("🧠 Extracting student intent")

    response = client.beta.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract student intent for college advising. "
                    "Return structured data only."
                ),
            },
            {"role": "user", "content": user_input},
        ],
        response_format=StudentIntent,
    )

    intent = response.choices[0].message.parsed
    logger.info(f"Intent confidence: {intent.confidence_score:.2f}")
    return intent


# --------------------------------------------------------------
# Advisor Agent (Function Calling Loop)
# --------------------------------------------------------------

def run_advisor_agent(user_input: str) -> Optional[AdvisorResponse]:
    logger.info("🚀 Advisor agent started")

    intent = extract_student_intent(user_input)
    if intent.confidence_score < 0.7:
        logger.warning("❌ Gate failed: low confidence")
        return None

    messages = [
        {
            "role": "system",
            "content": (
                "You are a college advisor. "
                "Use tools when helpful and respond in structured JSON."
            ),
        },
        {"role": "user", "content": user_input},
    ]

    logger.info("🤖 Sending request to OpenAI (tool-aware)")
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=tools,
    )

    assistant_message = response.choices[0].message

    # ----------------------------------------------------------
    # Handle tool calls (OpenAI-recommended flow)
    # ----------------------------------------------------------

    if assistant_message.tool_calls:
        logger.info(f"🛠 Model requested {len(assistant_message.tool_calls)} tool call(s)")
        messages.append(assistant_message)

        for call in assistant_message.tool_calls:
            tool_name = call.function.name
            args = json.loads(call.function.arguments)

            logger.info(f"➡️ Executing tool: {tool_name}")

            result = execute_tool(tool_name, args)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result),
                }
            )

        logger.info("🔁 Sending tool results back to OpenAI")
        final = client.beta.chat.completions.parse(
            model=MODEL,
            messages=messages,
            response_format=AdvisorResponse,
        )

        logger.info("✅ Final response generated")
        return final.choices[0].message.parsed

    # ----------------------------------------------------------
    # No tool needed
    # ----------------------------------------------------------

    logger.info("ℹ️ No tools required")
    final = client.beta.chat.completions.parse(
        model=MODEL,
        messages=messages + [assistant_message],
        response_format=AdvisorResponse,
    )

    logger.info("✅ Final response generated")
    return final.choices[0].message.parsed


# --------------------------------------------------------------
# CLI
# --------------------------------------------------------------

if __name__ == "__main__":
    print("🎓 College Advisor AI (Function Calling)")
    print("Type 'exit' to quit\n")

    while True:
        user_input = input("Student: ")
        if user_input.lower() == "exit":
            break

        result = run_advisor_agent(user_input)

        if not result:
            print("\nAdvisor: I'm not confident I understood your request.\n")
            continue

        print("\nAdvisor:", result.response)

        if result.schools:
            print("\n📚 Schools:")
            for s in result.schools:
                print(
                    f"- {s.name} ({s.city}, {s.state}) | "
                    f"Acceptance: {s.acceptance_rate or 'N/A'}"
                )
        print()
