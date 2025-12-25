import json
from model.config import client, MODEL, logger
from model.agent.intent import extract_student_intent
from model.agent.dispatcher import execute_tool
from model.agent.tools_schema import tools
from model.schemas.advisorResponse import AdvisorResponse
from typing import Optional

def run_advisor_agent(user_input: str) -> Optional[AdvisorResponse]:
    logger.info("🚀 Advisor agent start")

    intent = extract_student_intent(user_input)
    if intent.confidence_score < 0.7:
        logger.warning("Low confidence intent")
        return None
    logger.info(f" Success going on with {intent.confidence_score}%")
    messages = [
        {"role": "system", "content": "You are a college advisor. You will also consider about the student life, weather there"},
        {"role": "user", "content": user_input},
    ]

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=tools,
    )

    assistant_msg = response.choices[0].message

    if assistant_msg.tool_calls:
        messages.append(assistant_msg)

        for call in assistant_msg.tool_calls:
            result = execute_tool(
                call.function.name,
                json.loads(call.function.arguments)
            )

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result),
                }
            )

    final = client.beta.chat.completions.parse(
        model=MODEL,
        messages=messages,
        response_format=AdvisorResponse,
    )

    return final.choices[0].message.parsed
