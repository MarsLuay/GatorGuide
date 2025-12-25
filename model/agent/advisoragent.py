import json
from model.config import client, MODEL, logger
from model.agent.intent import extract_student_intent
from model.agent.dispatcher import execute_tool
from model.agent.tools_schema import tools
from model.agent.tools import get_weather
from model.schemas.advisorResponse import AdvisorResponse
from typing import Optional, List, Dict, Any

def safe_json_serialize(obj: Any) -> str:
    """
    Safely serialize a Python object to JSON string, handling non-serializable objects.
    
    Attempts direct JSON encoding first. Falls back to string representation for
    objects that cannot be serialized, preventing serialization errors when passing
    tool results to the LLM.
    
    Args:
        obj: Any Python object to serialize
        
    Returns:
        str: Valid JSON string representation of the object
        
    Example:
        >>> data = {"schools": [...], "error": None}
        >>> safe_json_serialize(data)
        '{"schools": [...], "error": null}'
    """
    try:
        # First attempt: direct JSON encoding
        return json.dumps(obj, default=str)
    except Exception as e:
        logger.error(f"JSON serialization error: {e}")
        # Fallback: convert to string representation
        return json.dumps({"error": f"Serialization failed: {str(e)}"})

def normalize_school_data(school: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform College Scorecard API flat-key response into nested structure for LLM processing.
    
    The College Scorecard API returns fields with dot notation as flat keys (e.g., "school.name"
    instead of {"school": {"name": ...}}). This function normalizes the structure to match
    the School pydantic model expected by AdvisorResponse, making it easier for the LLM to
    parse and return structured school data.
    
    Args:
        school (Dict[str, Any]): Raw school data from College Scorecard API with dot-notation keys
        
    Returns:
        Dict[str, Any]: Normalized school dict with keys matching School model:
            - name: School name
            - city: School city
            - state: 2-letter state code
            - acceptance_rate: Overall admission rate (0-1)
            - tuition_in_state: In-state tuition per year
            - tuition_out_of_state: Out-of-state tuition per year
            - weather: Weather object with temperature_celsius and wind_speed_kmh
            
    Example:
        Input:  {"school.name": "University of Washington", "school.state": "WA", "latest.admissions.admission_rate.overall": 0.39}
        Output: {"name": "University of Washington", "state": "WA", "acceptance_rate": 0.39, ...}
    """
    normalized = {
        "name": school.get("school.name", "Unknown"),
        "city": school.get("school.city", ""),
        "state": school.get("school.state", ""),
        "acceptance_rate": school.get("latest.admissions.admission_rate.overall"),
        "tuition_in_state": school.get("latest.cost.tuition.in_state"),
        "tuition_out_of_state": school.get("latest.cost.tuition.out_of_state"),
    }
    
    # Handle weather data - ensure it's properly formatted
    weather = school.get("weather")
    if weather and isinstance(weather, dict):
        normalized["weather"] = {
            "temperature_celsius": weather.get("temperature_celsius"),
            "wind_speed_kmh": weather.get("wind_speed_kmh"),
        }
    else:
        normalized["weather"] = None
    
    # Remove None values to keep JSON clean
    return {k: v for k, v in normalized.items() if v is not None or k in ["weather"]}

def enrich_schools_with_weather(schools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Augment school data with real-time weather information from campus coordinates.
    
    For each school in the input list, extracts campus coordinates (latitude/longitude)
    from the College Scorecard data and fetches current weather conditions using the
    Open-Meteo API. Weather data includes temperature and wind speed, providing
    students with insight into the student life experience at each campus.
    
    Args:
        schools (List[Dict[str, Any]]): List of schools from College Scorecard API with location.lat/location.lon
        
    Returns:
        List[Dict[str, Any]]: Same school list with added "weather" field containing:
            - temperature_celsius: Current temperature in Celsius
            - wind_speed_kmh: Current wind speed in km/h
            - None if coordinates unavailable or API call fails
            
    Side effects:
        - Logs coordinate extraction and weather fetch status
        - Handles API errors gracefully without failing
        
    Example:
        Input:  [{"school.name": "UW", "location.lat": 47.6550, "location.lon": -122.3035}]
        Output: [{"school.name": "UW", "location.lat": 47.6550, "location.lon": -122.3035, 
                   "weather": {"temperature_celsius": 8.5, "wind_speed_kmh": 12.3}}]
    """
    enriched = []
    for school in schools:
        # College Scorecard API returns flat keys with dots: "location.lat" not {"location": {"lat": ...}}
        lat = school.get("location.lat")
        lon = school.get("location.lon")
        school_name = school.get("school.name", "Unknown")
        
        logger.info(f"🔍 School: {school_name}, lat={lat}, lon={lon}")
        
        if lat and lon:
            try:
                logger.info(f"🌤️ Fetching weather for {school_name} at ({lat}, {lon})")
                weather_data = get_weather(latitude=lat, longitude=lon)
                school["weather"] = {
                    "temperature_celsius": weather_data.get("temperature_2m"),
                    "wind_speed_kmh": weather_data.get("wind_speed_10m"),
                }
                logger.info(f"✅ Weather fetched for {school_name}: {school['weather']}")
            except Exception as e:
                logger.warning(f"❌ Failed to fetch weather for {school_name}: {e}")
                school["weather"] = None
        else:
            logger.warning(f"⚠️ No coordinates found for {school_name}")
            school["weather"] = None
        
        enriched.append(school)
    
    return enriched

def run_advisor_agent(user_input: str) -> Optional[AdvisorResponse]:
    """
    Main advisor agent that interprets student queries and searches for suitable colleges.
    
    Orchestrates a multi-step agentic workflow:
    1. Extract student intent from natural language query
    2. Use Claude to decide which tools (college search, weather lookup) to invoke
    3. Execute selected tools and enrich results with real-time data
    4. Have Claude parse results into structured AdvisorResponse with school recommendations
    
    The agent understands implicit queries like "dream schools" (competitive/selective schools),
    school abbreviations (UW = University of Washington), and various advising scenarios
    (comparison, requirements, general guidance).
    
    Args:
        user_input (str): Student's natural language query about colleges
        
    Returns:
        Optional[AdvisorResponse]: Structured response containing:
            - response: Natural language advice from the advisor
            - schools: List of recommended School objects with name, location, acceptance rate, tuition, weather
            - Returns None if intent confidence is too low (<0.5)
            
    Raises:
        Exception: If API errors occur during tool execution
        
    Example:
        >>> run_advisor_agent("Show me competitive schools in California")
        AdvisorResponse(
            response="Here are some excellent selective schools in California...",
            schools=[
                School(name="Stanford University", state="CA", acceptance_rate=0.03, ...),
                School(name="Caltech", state="CA", acceptance_rate=0.03, ...),
                ...
            ]
        )
    """

    intent = extract_student_intent(user_input)
    if intent.confidence_score < 0.5:
        logger.warning(f"Low confidence intent: {intent.confidence_score}")
        return None
    logger.info(f"✅ Intent recognized: {intent.intent} with {intent.confidence_score:.0%} confidence")
    messages = [
        {
            "role": "system",
            "content": (
                "You are a college advisor helping students find suitable colleges. "
                "When students mention their GPA, SAT scores, or test scores, USE THOSE as filters in your search. "
                "For example: '1600 SAT' → use sat_score_range parameter if searching by state. "
                "When students mention 'dream schools', 'reach schools', 'top universities', or 'competitive', "
                "use acceptance_rate_range='0..0.5' (0-50% acceptance) to cast a wide net. "
                "ONLY use very restrictive ranges like '0..0.2' if they specifically say 'most selective' or 'hardest to get into'. "
                "School abbreviations: UW/UWash = University of Washington, UCLA, MIT, Stanford, etc. "
                "Each school result includes: name, location, acceptance rate, tuition, and current weather. "
                "Provide comprehensive advice considering all factors including student's stated qualifications."
            ),
        },
        {"role": "user", "content": user_input},
    ]

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=tools,
    )

    assistant_msg = response.choices[0].message
    college_results = []

    if assistant_msg.tool_calls:
        messages.append(assistant_msg)

        for call in assistant_msg.tool_calls:
            result = execute_tool(
                call.function.name,
                json.loads(call.function.arguments)
            )

            # If this is a college search, enrich with weather and normalize
            if call.function.name in ["search_colleges", "state_search_colleges"]:
                if isinstance(result, list):
                    logger.info(f"🌤️ Enriching {len(result)} schools with weather data")
                    result = enrich_schools_with_weather(result)
                    # Normalize the data structure for the LLM
                    result = [normalize_school_data(school) for school in result]
                    college_results.extend(result)
                    logger.info(f"📊 Sample normalized result: {result[0] if result else 'empty'}")

            # Serialize safely to JSON
            result_json = safe_json_serialize(result)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": result_json,
                }
            )

    final = client.beta.chat.completions.parse(
        model=MODEL,
        messages=messages,
        response_format=AdvisorResponse,
    )

    return final.choices[0].message.parsed
