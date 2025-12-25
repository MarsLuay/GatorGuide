"""
Tool dispatcher module for executing agent-selected tools.

This module manages tool routing and execution. When Claude decides to use a tool
(via function calling), this dispatcher executes it with the provided arguments
and returns results back to the agent for further processing.
"""

from model.agent.tools import (
    search_colleges,
    state_search_colleges,
    get_weather,
)
from model.config import logger

TOOL_REGISTRY = {
    "search_colleges": search_colleges,
    "state_search_colleges": state_search_colleges,
    "get_weather": get_weather,
}

def execute_tool(tool_name: str, args: dict):
    """
    Execute a registered tool with provided arguments.
    
    Dispatches tool execution based on the tool name selected by Claude.
    Acts as the gateway between the agent (LLM) and actual tool implementations.
    
    Args:
        tool_name (str): Name of the tool to execute (must be in TOOL_REGISTRY)
        args (dict): Arguments to pass to the tool function
        
    Returns:
        Any: Tool's return value (typically list of schools or weather dict)
        
    Raises:
        ValueError: If tool_name is not registered
        
    Example:
        >>> execute_tool("search_colleges", {"school_name": "MIT", "state": "MA", "limit": 5})
        [{"school.name": "MIT", "school.state": "MA", ...}, ...]
        
        >>> execute_tool("get_weather", {"latitude": 42.3601, "longitude": -71.0589})
        {"temperature_2m": 5.2, "wind_speed_10m": 12.1}
    """

    if tool_name not in TOOL_REGISTRY:
        logger.error(f"Unknown tool: {tool_name}")
        raise ValueError(tool_name)

    return TOOL_REGISTRY[tool_name](**args)