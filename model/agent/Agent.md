# GatorGuide Advisor Agent

The intelligent college recommendation engine powered by OpenAI GPT-5-nano.

## Overview

The advisor agent is an **agentic AI system** that interprets natural language queries from students and provides personalized college recommendations with comprehensive data (acceptance rates, tuition, weather, etc.).

### Architecture

```
User Query
    ↓
[Intent Extraction] → Classify query type & extract metadata (school names, state)
    ↓
[Agent Loop]
    ├→ OpenAI GPT-5-nano decides which tools to call (search_colleges, get_weather, etc.)
    ├→ [Tool Execution] → Fetch college data & weather
    ├→ [Data Enrichment] → Normalize data, add real-time weather
    ├→ OpenAI GPT-5-nano processes results
    └→ Repeat if needed
    ↓
[Response Parsing] → Parse advisor response + school list into AdvisorResponse
    ↓
Structured Output to Frontend
```

## Core Components

### 1. Intent Extraction (`intent.py`)

**Function:** `extract_student_intent(user_input: str) -> StudentIntent`

Classifies student queries and extracts key information:

- **Intent Types:**
  - `school_search`: Looking for specific schools
  - `comparison`: Comparing different schools
  - `general_advice`: Seeking college selection guidance
  - `requirements`: Questions about admissions standards
  - `off_topic`: Non-college related

- **Metadata Extraction:**
  - School name (expands abbreviations: UW → University of Washington)
  - State code (2-letter: WA, CA, TX)
  - Confidence score (0-1)

- **Recognition Examples:**
  - ✅ "Show me MIT" → school_search, school_name=MIT
  - ✅ "Dream schools with higher requirements" → school_search, confidence=0.75
  - ✅ "UW vs UCLA" → comparison
  - ✅ "What's a safety school?" → general_advice

### 2. Agent Orchestration (`advisoragent.py`)

**Main Function:** `run_advisor_agent(user_input: str) -> Optional[AdvisorResponse]`

Multi-step workflow:

1. **Intent Check** → Validate confidence ≥ 0.5
2. **Tool Calling** → OpenAI GPT-5-nano decides which tools to invoke
3. **Tool Execution** → Run search_colleges, state_search_colleges, get_weather
4. **Data Enrichment** → 
   - Normalize flat API keys to nested structure
   - Fetch real-time weather for each campus
5. **Response Parsing** → Extract structured advice + school list

#### Data Flow Through the Agent

```python
# College Scorecard API returns flat keys
Raw API: {"school.name": "MIT", "location.lat": 42.36, "location.lon": -71.06}
    ↓
# Enrich with weather
Enriched: {"school.name": "MIT", "location.lat": 42.36, ..., "weather": {...}}
    ↓
# Normalize to match School model
Normalized: {"name": "MIT", "acceptance_rate": 0.034, "weather": {...}}
    ↓
# LLM parses into AdvisorResponse
AdvisorResponse: {
    "response": "MIT is...",
    "schools": [School(name="MIT", ...)]
}
```

### 3. Tool Dispatcher (`dispatcher.py`)

**Function:** `execute_tool(tool_name: str, args: dict) -> Any`

Routes tool calls from OpenAI GPT-5-nano to implementations:

```python
TOOL_REGISTRY = {
    "search_colleges": search_colleges,
    "state_search_colleges": state_search_colleges,
    "get_weather": get_weather,
}
```

### 4. Tool Implementations (`tools.py`)

#### `search_colleges(school_name, state, limit) -> list`
Search for colleges by name/state. Returns College Scorecard data with:
- School name, city, state
- Acceptance rate, tuition (in/out-of-state)
- Campus coordinates (for weather lookups)

**Example:**
```python
search_colleges(school_name="Stanford", state="CA", limit=5)
# Returns: [{"school.name": "Stanford", "location.lat": 37.43, ...}]
```

#### `state_search_colleges(state, acceptance_rate_range, ...) -> list`
Find schools in a state with optional filters:
- Acceptance rate range: "0.1..0.3" (10-30%)
- Tuition range: "0..50000"
- SAT score range: "1400..1600"

**Example:**
```python
state_search_colleges(
    state="WA",
    acceptance_rate_range="0.0..0.5"  # Top 50%
)
# Returns competitive schools in Washington
```

#### `get_weather(latitude, longitude) -> dict`
Fetch real-time weather for campus coordinates (using Open-Meteo API).

**Returns:** `{"temperature_2m": 8.5, "wind_speed_10m": 12.1}`

## Data Models

### StudentIntent
```python
class StudentIntent(BaseModel):
    intent: str  # school_search, comparison, general_advice, requirements, off_topic
    school_name: Optional[str]  # Expanded form (e.g., "University of Washington")
    state: Optional[str]  # 2-letter code (e.g., "WA")
    confidence_score: float  # 0-1: >0.7 explicit, 0.5-0.7 implicit, <0.5 off-topic
```

### School
```python
class School(BaseModel):
    name: str
    city: str
    state: str  # 2-letter code
    acceptance_rate: Optional[float]  # 0-1 (e.g., 0.034 for 3.4%)
    tuition_in_state: Optional[int]  # Annual cost in dollars
    tuition_out_of_state: Optional[int]  # Annual cost in dollars
    weather: Optional[Weather]  # Current conditions
```

### AdvisorResponse
```python
class AdvisorResponse(BaseModel):
    response: str  # Natural language advice from advisor
    schools: Optional[List[School]]  # Recommended schools with full data
```

## Usage Examples

### Example 1: Simple School Search
```python
run_advisor_agent("Show me University of Washington")

Output:
AdvisorResponse(
    response="University of Washington (UW) is an excellent public research institution...",
    schools=[
        School(
            name="University of Washington",
            state="WA",
            acceptance_rate=0.39,
            tuition_in_state=12315,
            weather=Weather(temperature_celsius=8, wind_speed_kmh=12)
        )
    ]
)
```

### Example 2: Dream Schools (Competitive Schools)
```python
run_advisor_agent("I want dream schools with higher requirements like MIT")

Output:
AdvisorResponse(
    response="MIT is one of the most selective...",
    schools=[
        School(name="MIT", state="MA", acceptance_rate=0.034, ...),
        School(name="Caltech", state="CA", acceptance_rate=0.030, ...),
        ...
    ]
)
```

### Example 3: State-Based Search
```python
run_advisor_agent("Show me universities in California")

Output:
AdvisorResponse(
    response="California has many excellent universities...",
    schools=[
        School(name="Stanford University", state="CA", ...),
        School(name="Caltech", state="CA", ...),
        School(name="UC Berkeley", state="CA", ...),
        ...
    ]
)
```

## Key Features

### 🎯 Intelligent Query Understanding
- Recognizes **implicit queries**: "dream schools" = competitive schools, "top universities" = 0-50% acceptance
- Extracts **student qualifications**: "1600 SAT" → uses sat_score_range parameter
- Expands **abbreviations**: UW → University of Washington
- Handles **various intents**: search, compare, get requirements
- Adapts acceptance filters: "top" = 0-50%, "most selective" = 0-20%
- Low confidence threshold (0.5) accepts implicit queries

### 📊 Comprehensive Data
Each recommended school includes:
- **Admissions**: Acceptance rate (auto-detects decimal 0-1 or percentage 0-100 format)
- **Financial**: In-state and out-of-state tuition
- **Location**: City, state, coordinates
- **Student Life**: Real-time campus weather
- **Filtering**: SAT scores extracted from student queries and used in searches

### 🌤️ Real-Time Weather Integration
Automatically fetches current weather for each campus location using Open-Meteo API:
- Temperature and wind speed
- Helps students understand regional climate
- Adds to the "student life" consideration

### 🔄 Multi-Turn Agentic Loop
OpenAI GPT-5-nano can:
1. Decide which tools to call
2. Process initial results
3. Ask for follow-up data
4. Refine recommendations

### ✨ Robust Error Handling
- Safe JSON serialization with fallbacks
- Graceful degradation if weather API fails
- Low confidence queries return None instead of bad results

## Configuration

### Environment Variables
```bash
# Required: College Scorecard API Key
export COLLEGE_SCORECARD_API_KEY="your_api_key_here"

# Optional: LLM configuration
export OPENAI_API_KEY="your_key"
export OPENAI_MODEL="gpt-4o"
```

### Get College Scorecard API Key
1. Go to https://api.data.gov/
2. Sign up and get your free API key
3. Use it for unlimited College Scorecard queries

## Debugging

### Enable Detailed Logging
```python
# Check logs for:
# 🧠 Extracting intent
# 🚀 Advisor agent start
# ✅ Intent recognized
# 🛠 Executing tool
# 🌤️ Enriching schools with weather
# 📊 Sample normalized result
```

### Common Issues

**Issue:** Weather always returns `None`
- **Cause:** Coordinates missing from College Scorecard data
- **Fix:** Verify API request includes `location.lat,location.lon` fields

**Issue:** Low confidence intent rejected
- **Cause:** Query too vague or off-topic
- **Fix:** Make queries more specific ("MIT" vs. "a good school")

**Issue:** School names expanded incorrectly
- **Fix:** Use full name in query ("Massachusetts Institute of Technology" vs. "MIT")

## Files

| File | Purpose |
|------|---------|
| `advisoragent.py` | Main agent orchestration & data enrichment |
| `intent.py` | Student query classification |
| `dispatcher.py` | Tool routing & execution |
| `tools.py` | College search & weather lookup implementations |
| `tools_schema.py` | Tool definitions for OpenAI GPT-5-nano |
| `schemas/advisorResponse.py` | Response data model |
| `schemas/school.py` | School data model |
| `schemas/studentIntent.py` | Intent classification model |

## Performance Notes

- **Intent Extraction:** ~500ms (LLM call)
- **College Search:** ~1-2s per API call
- **Weather Fetch:** ~200ms per school (Open-Meteo API)
- **Full Agent Pipeline:** 5-10s total (depends on tool usage)

## Future Enhancements

- [ ] Caching college data to reduce API calls
- [ ] Support for advanced filters (GPA requirements, test scores)
- [ ] Financial aid and scholarship information
- [ ] Student reviews and ratings integration
- [ ] Personalized recommendations based on student profile
- [ ] Multi-turn conversation history tracking
- [ ] School comparison tables
