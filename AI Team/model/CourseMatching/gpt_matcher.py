from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Sequence

from rlhf_matcher import Course, School, load_schools_from_dict

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")


@dataclass(frozen=True)
class CourseMatchCandidate:
    source_school: str
    source_course_code: str
    source_course_name: str
    target_school: str
    target_course_code: str
    target_course_name: str
    confidence: float
    rationale: str


def _tokenize(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _extract_code_prefix(code: str) -> str:
    return "".join(ch for ch in code if ch.isalpha()).upper()


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_json_object(text: str) -> Dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return {}


def _heuristic_score(source: Course, target: Course) -> float:
    source_tokens = _tokenize(source.name + " " + source.description)
    target_tokens = _tokenize(target.name + " " + target.description)
    if not source_tokens or not target_tokens:
        overlap = 0.0
    else:
        overlap = len(source_tokens.intersection(target_tokens)) / len(source_tokens.union(target_tokens))

    prefix_bonus = 0.12 if _extract_code_prefix(source.code) == _extract_code_prefix(target.code) else 0.0
    name_overlap = len(_tokenize(source.name).intersection(_tokenize(target.name))) * 0.08
    return min(1.0, overlap + prefix_bonus + name_overlap)


def shortlist_targets(source_course: Course, target_courses: Sequence[Course], top_n: int = 5) -> List[Course]:
    ranked = sorted(target_courses, key=lambda c: _heuristic_score(source_course, c), reverse=True)
    return ranked[: max(1, min(top_n, len(ranked)))]


class GPTCourseMatcher:
    def __init__(
        self,
        model: str = "gpt-4.1-mini",
        api_key: str | None = None,
        temperature: float = 0.0,
    ) -> None:
        self.model = model
        self.temperature = temperature
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if (OpenAI and self.api_key) else None

    @property
    def llm_enabled(self) -> bool:
        return self.client is not None

    def _build_prompt(self, source_school: School, target_school: School, source_course: Course, candidates: Sequence[Course]) -> str:
        candidate_lines = []
        for course in candidates:
            candidate_lines.append(
                f"- code: {course.code} | name: {course.name} | description: {course.description}"
            )

        return (
            "You are an expert transfer-credit evaluator.\n"
            "Given one source course and destination candidates, rank the candidates by transfer equivalency.\n"
            "Return ONLY valid JSON with this schema:\n"
            "{\n"
            '  "matches": [\n'
            "    {\"target_code\": string, \"target_name\": string, \"confidence\": number, \"rationale\": string}\n"
            "  ]\n"
            "}\n"
            "Rules:\n"
            "- confidence must be between 0 and 1\n"
            "- include all provided candidates exactly once\n"
            "- higher confidence means stronger equivalency\n"
            "- prioritize learning outcomes, topic coverage, and sequence level\n\n"
            f"Source school: {source_school.name}\n"
            f"Destination school: {target_school.name}\n"
            f"Source course: {source_course.code} | {source_course.name} | {source_course.description}\n"
            "Destination candidates:\n"
            + "\n".join(candidate_lines)
        )

    def _rank_with_llm(
        self,
        source_school: School,
        target_school: School,
        source_course: Course,
        candidates: Sequence[Course],
    ) -> List[CourseMatchCandidate]:
        assert self.client is not None

        prompt = self._build_prompt(source_school, target_school, source_course, candidates)

        response = self.client.responses.create(
            model=self.model,
            input=prompt,
            temperature=self.temperature,
        )
        payload = _extract_json_object(response.output_text)

        course_by_code = {c.code: c for c in candidates}
        raw_matches = payload.get("matches", []) if isinstance(payload, dict) else []

        parsed: List[CourseMatchCandidate] = []
        seen_codes = set()
        for item in raw_matches:
            if not isinstance(item, dict):
                continue
            code = str(item.get("target_code", "")).strip()
            if code not in course_by_code or code in seen_codes:
                continue

            target = course_by_code[code]
            parsed.append(
                CourseMatchCandidate(
                    source_school=source_school.name,
                    source_course_code=source_course.code,
                    source_course_name=source_course.name,
                    target_school=target_school.name,
                    target_course_code=target.code,
                    target_course_name=target.name,
                    confidence=max(0.0, min(1.0, _safe_float(item.get("confidence"), default=0.0))),
                    rationale=str(item.get("rationale", "")).strip() or "No rationale provided.",
                )
            )
            seen_codes.add(code)

        # Fall back to deterministic heuristic completion when model omits candidates.
        for candidate in candidates:
            if candidate.code in seen_codes:
                continue
            parsed.append(
                CourseMatchCandidate(
                    source_school=source_school.name,
                    source_course_code=source_course.code,
                    source_course_name=source_course.name,
                    target_school=target_school.name,
                    target_course_code=candidate.code,
                    target_course_name=candidate.name,
                    confidence=_heuristic_score(source_course, candidate),
                    rationale="Fallback lexical/content similarity score.",
                )
            )

        parsed.sort(key=lambda m: m.confidence, reverse=True)
        return parsed

    def _rank_with_heuristics(
        self,
        source_school: School,
        target_school: School,
        source_course: Course,
        candidates: Sequence[Course],
    ) -> List[CourseMatchCandidate]:
        rows: List[CourseMatchCandidate] = []
        for candidate in candidates:
            rows.append(
                CourseMatchCandidate(
                    source_school=source_school.name,
                    source_course_code=source_course.code,
                    source_course_name=source_course.name,
                    target_school=target_school.name,
                    target_course_code=candidate.code,
                    target_course_name=candidate.name,
                    confidence=_heuristic_score(source_course, candidate),
                    rationale="Heuristic fallback (OPENAI_API_KEY missing).",
                )
            )
        rows.sort(key=lambda m: m.confidence, reverse=True)
        return rows

    def generate_matches(
        self,
        source_school: School,
        target_school: School,
        shortlist_size: int = 5,
        top_k: int = 3,
    ) -> List[CourseMatchCandidate]:
        all_rows: List[CourseMatchCandidate] = []
        for source_course in source_school.courses:
            shortlist = shortlist_targets(source_course, target_school.courses, top_n=shortlist_size)
            if self.llm_enabled:
                ranked = self._rank_with_llm(source_school, target_school, source_course, shortlist)
            else:
                ranked = self._rank_with_heuristics(source_school, target_school, source_course, shortlist)
            all_rows.extend(ranked[: max(1, top_k)])
        return all_rows


def load_schools_file(path: str | Path) -> List[School]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return load_schools_from_dict(payload)


def save_matches(path: str | Path, matches: Sequence[CourseMatchCandidate]) -> None:
    rows = [asdict(row) for row in matches]
    Path(path).write_text(json.dumps(rows, indent=2), encoding="utf-8")
