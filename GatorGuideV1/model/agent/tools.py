"""
Tool implementations for college search and weather lookup.

This module provides the actual functions that the advisor agent calls to:
1. Search for colleges using the US Department of Education's College Scorecard API
2. Fetch current weather data from campus coordinates using Open-Meteo API
"""

import requests
from typing import Optional
from model.config import logger

COLLEGE_SCORECARD_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"
from os import getenv

API_KEY = getenv("COLLEGE_SCORECARD_API_KEY")

def get_weather(latitude: float, longitude: float) -> dict:
    """
    Fetch current weather conditions for a given location.
    
    Uses the free Open-Meteo API (no authentication required) to get real-time
    weather data for a campus location. Provides students with information about
    the climate and weather patterns at their potential colleges.
    
    Args:
        latitude (float): Latitude coordinate of the location (e.g., 47.6550 for UW)
        longitude (float): Longitude coordinate of the location (e.g., -122.3035 for UW)
        
    Returns:
        dict: Current weather data containing:
            - temperature_2m: Current temperature in Celsius
            - wind_speed_10m: Current wind speed in km/h
            
    Raises:
        requests.RequestException: If API call fails
        
    Example:
        >>> get_weather(47.6550, -122.3035)  # University of Washington
        {'temperature_2m': 8.5, 'wind_speed_10m': 12.1, ...}
    """
    response = requests.get(
        f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m"
    )
    data = response.json()
    return data["current"]


def search_colleges(
    school_name: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 5,
) -> list:
    """
    Search for colleges by name and/or state using College Scorecard API.
    
    Queries the US Department of Education's College Scorecard database to find schools
    matching the search criteria. Returns detailed information including admissions stats,
    tuition costs, and campus coordinates for weather lookup.
    
    Args:
        school_name (Optional[str]): Full or partial college name to search for
            (e.g., "MIT", "University of Washington", "Washington")
        state (Optional[str]): Two-letter US state code (e.g., "MA", "WA", "CA")
        limit (int): Maximum number of results to return (default: 5, max recommended: 10)
        
    Returns:
        list: List of school dictionaries with keys:
            - school.name, school.city, school.state
            - location.lat, location.lon (for weather lookups)
            - latest.admissions.admission_rate.overall
            - latest.cost.tuition.in_state, latest.cost.tuition.out_of_state
            
    Raises:
        requests.RequestException: If API call fails
        
    Example:
        >>> search_colleges(school_name="MIT", state="MA", limit=1)
        [{
            'school.name': 'Massachusetts Institute of Technology',
            'school.state': 'MA',
            'location.lat': 42.3601,
            'location.lon': -71.0589,
            'latest.admissions.admission_rate.overall': 0.034,
            ...
        }]
    """

    params = {
        "api_key": API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
            "location.lat,location.lon,"
            "latest.admissions.admission_rate.overall,"
            "latest.cost.tuition.in_state,"
            "latest.cost.tuition.out_of_state"
        ),
        "per_page": limit,
    }

    if school_name:
        params["school.name"] = school_name
    if state:
        params["school.state"] = state

    response = requests.get(COLLEGE_SCORECARD_URL, params=params)
    response.raise_for_status()

    results = response.json()["results"]
    logger.info(f"📊 Sample school data structure: {results[0] if results else 'No results'}")
    return results

def state_search_colleges(
    state: str,
    school_name: Optional[str] = None,
    acceptance_rate_range: Optional[str] = None,
    in_state_tuition_range: Optional[str] = None,
    sat_score_range: Optional[str] = None,
    limit: int = 5,
) -> list:
    """
    Search for colleges in a specific state with optional filters.
    
    Specialized search for finding schools within a particular state, with support for
    filtering by acceptance rate, tuition cost, and SAT score ranges. Useful for
    students targeting a specific region or looking for schools with particular
    admission competitiveness.
    
    Args:
        state (str): Two-letter US state code (required, e.g., "CA", "TX", "NY")
        school_name (Optional[str]): Additional filter by school name within state
        acceptance_rate_range (Optional[str]): Filter format "MIN..MAX" (e.g., "0.1..0.3"
            for schools with 10-30% acceptance rates)
        in_state_tuition_range (Optional[str]): Filter format "MIN..MAX" in dollars
            (e.g., "0..25000" for schools under $25k)
        sat_score_range (Optional[str]): Filter format "MIN..MAX" average SAT range
        limit (int): Maximum number of results to return (default: 5)
        
    Returns:
        list: List of school dictionaries with College Scorecard fields including
            acceptance rate, SAT scores, tuition, and location data
            
    Raises:
        requests.RequestException: If API call fails
        
    Example:
        >>> state_search_colleges(
        ...     state="CA",
        ...     acceptance_rate_range="0.0..0.2",  # Top 20%
        ...     limit=5
        ... )
        [{
            'school.name': 'Stanford University',
            'latest.admissions.admission_rate.overall': 0.034,
            ...
        }, ...]
    """
    logger.info(
        f"Arguments: state={state}, acceptance={acceptance_rate_range}, "
        f"tuition={in_state_tuition_range}, SAT={sat_score_range}"
    )

    params = {
        "api_key": API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
            "location.lat,location.lon,"
            "latest.admissions.admission_rate.overall,"
            "latest.admissions.sat_scores.average.overall,"
            "latest.cost.tuition.in_state,"
            "latest.earnings.6_yrs_after_entry.median"
        ),
        "school.state": state,
        "per_page": limit,
    }

    if school_name:
        params["school.name"] = school_name
    if acceptance_rate_range:
        params["latest.admissions.admission_rate.overall__range"] = acceptance_rate_range
    if in_state_tuition_range:
        params["latest.cost.tuition.in_state__range"] = in_state_tuition_range
    if sat_score_range:
        params["latest.admissions.sat_scores.average.overall__range"] = sat_score_range

    logger.info("🌐 Calling College Scorecard API")
    response = requests.get(COLLEGE_SCORECARD_URL, params=params)
    response.raise_for_status()

    results = response.json()["results"]
    logger.info(f"✅ Tool returned {len(results)} schools")
    return results

