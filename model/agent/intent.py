from model.config import client, MODEL, logger
from model.schemas.studentIntent import StudentIntent

def extract_student_intent(user_input: str) -> StudentIntent:
    """
    Classify student query and extract relevant metadata using LLM parsing.
    
    Analyzes the student's natural language input to determine:
    - Intent type: school_search, comparison, general_advice, requirements, off_topic
    - School name: Expands abbreviations (UW -> University of Washington)
    - State: Extracts 2-letter state codes if mentioned
    - Confidence: 0-1 score indicating how clearly college-related the query is
    
    The classifier recognizes implicit queries like "dream schools", "reach schools",
    "higher requirements", and various abbreviations (UW, UCLA, MIT, etc.).
    
    Args:
        user_input (str): Student's natural language query
        
    Returns:
        StudentIntent: Contains intent, school_name, state, and confidence_score
        
    Example:
        >>> extract_student_intent("I want to aim for my dream schools like UWash")
        StudentIntent(
            intent="school_search",
            school_name="University of Washington",
            state="WA",
            confidence_score=0.85
        )
    """

    response = client.beta.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are analyzing student queries about college admissions. "
                    "Extract the student's intent and provide a confidence score (0-1).\n\n"
                    "Valid college-related intents include:\n"
                    "- 'school_search': Looking for specific schools by name, location, or characteristics\n"
                    "- 'comparison': Comparing schools or asking about options\n"
                    "- 'general_advice': Seeking guidance on college selection, admissions, requirements\n"
                    "- 'requirements': Asking about acceptance rates, SAT scores, competitiveness\n\n"
                    "Recognize queries even when implicit:\n"
                    "- 'dream schools', 'reach schools', 'safety schools'\n"
                    "- School abbreviations like 'UW', 'UWash', 'UCLA', 'MIT'\n"
                    "- 'higher requirements', 'competitive', 'selective'\n"
                    "- Location mentions: states, cities, regions\n\n"
                    "Set confidence_score high (>0.7) if clearly college-related, moderate (0.5-0.7) if implicit.\n"
                    "Extract school_name if mentioned (expand abbreviations to full names when obvious).\n"
                    "Extract state as 2-letter code if mentioned (e.g., WA for Washington)."
                ),
            },
            {"role": "user", "content": user_input},
        ],
        response_format=StudentIntent,
    )

    return response.choices[0].message.parsed
