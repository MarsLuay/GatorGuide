tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current temperature for provided coordinates in celsius.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                },
                "required": ["latitude", "longitude"],
                "additionalProperties": False,
            },
            "strict": True,
        },
    },
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
            "description": "Search colleges in a U.S. state",
            "parameters": {
                "type": "object",
                "properties": {
                    "state": {"type": "string"},
                    "acceptance_rate_range": {"type": "string"},
                },
                "required": ["state"],
            },
        },
    },
]
