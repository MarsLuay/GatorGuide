import requests
from typing import Optional
from model.config import logger

COLLEGE_SCORECARD_URL = "https://api.data.gov/ed/collegescorecard/v1/schools"
from os import getenv

API_KEY = getenv("COLLEGE_SCORECARD_API_KEY")

def get_weather(latitude, longitude):
    """This is a publically available API that returns the weather for a given location."""
    response = requests.get(
        f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m"
    )
    data = response.json()
    return data["current"]


def search_colleges(
    school_name: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 3,
):
    logger.info("🔧 search_colleges called")

    params = {
        "api_key": API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
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

    return response.json()["results"]

def state_search_colleges(
    state: str,
    school_name: Optional[str] = None,
    acceptance_rate_range: Optional[str] = None,
    in_state_tuition_range: Optional[str] = None,
    sat_score_range: Optional[str] = None,
    limit: int = 5,
):
    logger.info("🔧 Tool: state_search_colleges called")
    logger.info(
        f"Arguments: state={state}, acceptance={acceptance_rate_range}, "
        f"tuition={in_state_tuition_range}, SAT={sat_score_range}"
    )

    params = {
        "api_key": API_KEY,
        "fields": (
            "school.name,school.city,school.state,"
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

