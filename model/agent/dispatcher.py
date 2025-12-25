from model.agent.tools import (
    search_colleges,
    state_search_colleges,
    get_weather,
)
from model.config import logger

TOOL_REGISTRY = {
    "search_colleges": search_colleges,
    "state_search_colleges": state_search_colleges,
    "get_weather" : get_weather,
}

def execute_tool(tool_name: str, args: dict):
    logger.info(f"🛠 Executing tool: {tool_name}")

    if tool_name not in TOOL_REGISTRY:
        logger.error(f"Unknown tool: {tool_name}")
        raise ValueError(tool_name)

    return TOOL_REGISTRY[tool_name](**args)