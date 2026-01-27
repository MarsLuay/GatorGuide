tools = [
    {
        "type": "function",
        "function": {
            "name": "search_colleges",
            "description": "Search for colleges by name and/or state using College Scorecard data. Use this for specific school searches (e.g., 'UWash', 'University of Washington') or when student mentions schools by name or abbreviation. Can filter by state.",
            "parameters": {
                "type": "object",
                "properties": {
                    "school_name": {
                        "type": "string",
                        "description": "Name or partial name of the college to search for (e.g., 'University of Washington', 'Washington')",
                    },
                    "state": {
                        "type": "string",
                        "description": "Two-letter U.S. state code (e.g., 'WA', 'CA')",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5, increase for broader searches)",
                    },
                },
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "state_search_colleges",
            "description": "Search colleges in a specific U.S. state with optional filters for acceptance rate. Use this when the user specifies a state or asks about colleges in a particular location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "state": {
                        "type": "string",
                        "description": "Two-letter U.S. state code (e.g., 'FL', 'CA')",
                    },
                    "acceptance_rate_range": {
                        "type": "string",
                        "description": "Range format: '0.5..1' for 50%-100% acceptance rate",
                    },
                },
                "required": ["state"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current temperature and weather conditions for a college location (use AFTER finding colleges to provide student life context). Requires latitude and longitude coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {
                        "type": "number",
                        "description": "Latitude coordinate of the location",
                    },
                    "longitude": {
                        "type": "number",
                        "description": "Longitude coordinate of the location",
                    },
                },
                "required": ["latitude", "longitude"],
                "additionalProperties": False,
            },
        },
    },
]
