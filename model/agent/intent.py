from model.config import client, MODEL, logger
from model.schemas.studentIntent import StudentIntent

def extract_student_intent(user_input: str) -> StudentIntent:
    logger.info("🧠 Extracting intent")

    response = client.beta.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract student intent and include confidence_score (0–1)."
                ),
            },
            {"role": "user", "content": user_input},
        ],
        response_format=StudentIntent,
    )

    return response.choices[0].message.parsed
