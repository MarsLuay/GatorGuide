"""RLHF-based course matching package."""

from .gpt_matcher import CourseMatchCandidate, GPTCourseMatcher
from .rlhf_matcher import (
    Course,
    School,
    MatchResult,
    RLHFCourseMatcher,
    load_schools_from_dict,
)

__all__ = [
    "Course",
    "School",
    "MatchResult",
    "CourseMatchCandidate",
    "GPTCourseMatcher",
    "RLHFCourseMatcher",
    "load_schools_from_dict",
]
