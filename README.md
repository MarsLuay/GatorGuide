# GatorGuide

An AI-powered college advisor chatbot that helps students discover and evaluate suitable colleges based on their preferences, requirements, and aspirations.

## 🎓 Overview

GatorGuide combines:
- **Intelligent Agent AI** (OpenAI GPT-5-nano) to understand student queries
- **College Scorecard API** for comprehensive college data
- **Real-time Weather API** for campus climate insights
- **Streamlit Frontend** for intuitive chat interface

Students chat with the advisor to get personalized recommendations for colleges including:
- Acceptance rates and admission competitiveness
- Tuition costs (in-state & out-of-state)
- Campus location and weather
- Comprehensive advising about fit

## 🚀 Quick Start

### 1. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set Up Environment

Create a `.env` file in the project root:

```bash
# Required: Get free API key from https://api.data.gov/
COLLEGE_SCORECARD_API_KEY=your_key_here

# Optional: OpenAI API key (defaults to environment)
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o
```

### 3. Run the Backend API

```bash
python model/api.py
# or
uvicorn model.api:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`

### 4. Run the Frontend

```bash
streamlit run frontEnd/mainpage.py
```

The chat UI will open at `http://localhost:8501`

## 📁 Project Structure

```
GatorGuide/
├── frontEnd/
│   └── mainpage.py              # Streamlit chat interface
├── model/
│   ├── api.py                   # FastAPI backend
│   ├── config.py                # Configuration & logger
│   ├── agent/
│   │   ├── advisoragent.py      # Main advisor agent orchestration
│   │   ├── intent.py            # Query intent classification
│   │   ├── dispatcher.py        # Tool routing & execution
│   │   ├── tools.py             # College search & weather tools
│   │   ├── tools_schema.py      # Tool definitions for Claude
│   │   └── README.md            # Agent documentation
│   └── schemas/
│       ├── advisorResponse.py   # Response format
│       ├── school.py            # School data model
│       └── studentIntent.py     # Intent classification model
├── requirements.txt              # Python dependencies
└── README.md                      # This file
```

## 🤖 How It Works

### User Interaction Flow

```
User: "Show me competitive schools in California"
    ↓
[Chat UI] Sends query to API
    ↓
[Intent Extraction] Classifies as "school_search" in California
    ↓
[Agent] Claude decides to call state_search_colleges()
    ↓
[Tool Execution] Searches CA schools with low acceptance rates
    ↓
[Data Enrichment] Adds real-time weather for each campus
    ↓
[Response Parsing] Claude generates advice + school list
    ↓
[API] Returns structured response to frontend
    ↓
[Chat UI] Displays schools with acceptance rates, tuition, weather
```

## 💬 Example Queries

The agent understands various natural language queries:

| Query | Agent Response |
|-------|---|
| "Show me MIT" | Searches for MIT, returns acceptance rate, tuition, weather |
| "I have 1600 SAT, 3.95 GPA. Top universities in Washington" | Uses SAT filter, searches top WA schools (0-50% acceptance) |
| "I want dream schools" | Searches for competitive schools with broader range (0-50%) |
| "Universities in Texas" | Lists colleges in TX with comprehensive data |
| "UW vs UCLA" | Compares University of Washington and UCLA |
| "What are reach schools?" | Provides advising on school tiers |
| "Show me most selective colleges in California" | Very restrictive filter (0-20% acceptance) |

## 🔧 Core Components

### Frontend (`frontEnd/mainpage.py`)

Streamlit-based chat interface featuring:
- Real-time message history display
- School cards with acceptance rates, tuition, weather
- Configurable API URL and request timeout
- Clean, responsive design

```bash
streamlit run frontEnd/mainpage.py
```

### Backend API (`model/api.py`)

FastAPI server with single endpoint:

**Endpoint:** `POST /advisor`

Request:
```json
{
    "student_input": "Show me colleges in California"
}
```

Response:
```json
{
    "response": "Here are some excellent California schools...",
    "schools": [
        {
            "name": "Stanford University",
            "state": "CA",
            "city": "Palo Alto",
            "acceptance_rate": 0.034,
            "tuition_in_state": 61368,
            "tuition_out_of_state": 61368,
            "weather": {
                "temperature_celsius": 18.5,
                "wind_speed_kmh": 8.2
            }
        }
    ]
}
```

### Agent System (`model/agent/`)

See [model/agent/README.md](model/agent/README.md) for detailed documentation.

Key components:
- **Intent Extraction:** Classifies student queries
- **Tool Dispatcher:** Routes Claude's tool calls
- **College Search:** Queries College Scorecard API
- **Weather Lookup:** Fetches campus climate data
- **Data Enrichment:** Normalizes and combines data

## 📊 Data Sources

### College Scorecard API
- **Provider:** US Department of Education
- **Data:** Acceptance rates, tuition, SAT scores, campus coordinates
- **URL:** https://api.data.gov/ed/collegescorecard/v1/schools
- **API Key:** Free at https://api.data.gov/

### Open-Meteo API
- **Provider:** Open-Meteo.com
- **Data:** Real-time weather and climate
- **Features:** Free, no authentication required
- **Update:** Real-time

## ⚙️ Configuration

### API Configuration

```python
# model/config.py
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-5-nano"  # OpenAI model for agent reasoning

# Default search settings
DEFAULT_SEARCH_LIMIT = 5  # Returns 5 schools per query
DEFAULT_ACCEPTANCE_RANGE = "0..0.5"  # 0-50% for "top" schools
```

### Frontend Configuration

Adjust in the Streamlit sidebar or via environment variables:

```bash
# API endpoint (default: http://127.0.0.1:8000)
export GATORGUIDE_API_URL="http://localhost:8000"

# Request timeout (default: 120 seconds)
export GATORGUIDE_API_TIMEOUT="180"

# Run frontend
streamlit run frontEnd/mainpage.py
```

## 🧪 Testing

### Test Intent Extraction
```python
from model.agent.intent import extract_student_intent

result = extract_student_intent("Show me MIT")
print(result)
# StudentIntent(intent='school_search', school_name='MIT', confidence_score=0.95)
```

### Test College Search
```python
from model.agent.tools import search_colleges

schools = search_colleges(school_name="MIT", state="MA", limit=1)
print(schools[0]["school.name"])
# "Massachusetts Institute of Technology"
```

### Test Agent
```python
from model.agent.advisoragent import run_advisor_agent

response = run_advisor_agent("Show me colleges in California")
print(response.response)
print(f"Found {len(response.schools)} schools")
```

## 📈 Performance

| Component | Time |
|-----------|------|
| Intent extraction | ~500ms |
| College search API call | ~1-2s |
| Weather fetch per school | ~200ms |
| Full agent pipeline (5 schools) | 5-10s |
| Frontend response display | <100ms |

### Optimization Tips

1. **Increase timeout for slow connections:** `export GATORGUIDE_API_TIMEOUT="300"`
2. **Cache College Scorecard results** (future enhancement)
3. **Batch weather requests** instead of sequential calls
4. **Use gpt-4o-mini** for faster, cheaper responses

## 🐛 Troubleshooting

### API Connection Error
```
Error: HTTPConnectionPool(host='127.0.0.1', port=8000): Connection refused
```
**Solution:** Ensure API is running: `python model/api.py`

### Timeout Error
```
Error: Read timeout after 120s
```
**Solutions:**
1. Increase timeout in sidebar to 180-300 seconds
2. Check if College Scorecard API is responding
3. Reduce query scope (search specific state vs all schools)

### Weather Data is None
**Solution:** This is normal if coordinates unavailable. The advisor still provides school recommendations.

### Low Confidence Intent Rejected
**Solution:** Make queries more specific:
- ❌ "a good school" → ✅ "MIT" or "colleges in California"

### Python Version Issues
```bash
# Ensure Python 3.9+
python --version

# Create fresh venv if needed
rm -rf .venv
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 🔐 Environment Variables

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `COLLEGE_SCORECARD_API_KEY` | College data access | Yes | `abc123def456` |
| `OPENAI_API_KEY` | Claude API access | Yes | `sk-proj-...` |
| `OPENAI_MODEL` | Claude model to use | No | `gpt-4o` |
| `GATORGUIDE_API_URL` | API endpoint (frontend) | No | `http://localhost:8000` |
| `GATORGUIDE_API_TIMEOUT` | Request timeout (frontend) | No | `180` |

## 📚 Documentation

- **Agent Details:** See [model/agent/Agent.md](model/agent/Agent.md)
- **Code Docstrings:** Comprehensive docstrings in all Python files
- **Data Models:** See `model/schemas/` directory

## 🚀 Deployment

### Docker Deployment (Coming Soon)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "model.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Considerations
- Use environment variables for all secrets
- Set proper CORS policies for frontend/backend
- Cache College Scorecard results
- Rate limit API endpoints
- Monitor agent latency and accuracy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add/update docstrings for new functions
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🎯 Future Enhancements

- [ ] Multi-turn conversation context
- [ ] Student profile matching (GPA, test scores)
- [ ] Financial aid and scholarship information
- [ ] Student reviews and ratings
- [ ] School comparison tables and exports
- [ ] Advanced filtering by major/program
- [ ] Campus visit scheduling
- [ ] Mobile app
- [ ] Voice chat interface
- [ ] Personalized recommendations engine

## 📞 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review [model/agent/README.md](model/agent/README.md) for agent details
3. Check code docstrings for function documentation
4. Open an issue on GitHub

---

**Made with ❤️ to help students find their perfect college**

