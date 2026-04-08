from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

from gpt_matcher import GPTCourseMatcher, save_matches
from rlhf_matcher import load_schools_from_dict, save_schools_to_json


school_input = {
    "schools": [
        {
            "name": "University of Washington",
            "location": "Seattle, WA",
            "courses": [
                {
                    "code": "PHYS 121",
                    "name": "Mechanics",
                    "description": "Basic principles of mechanics and experiments in mechanics for physical science and engineering majors. Lecture tutorial and lab components must all be taken to receive credit.",
                },
                {
                    "code": "PHYS 122",
                    "name": "Electromagnetism",
                    "description": "Covers the basic principles of electromagnetism and experiments in these topics for physical science and engineering majors. Lecture tutorial and lab components must all be taken to receive credit.",
                },
                {
                    "code": "MATH 124",
                    "name": "Calculus I",
                    "description": "First quarter in calculus of functions of a single variable. Emphasizes differential calculus. Emphasizes applications and problem solving using the tools of calculus.",
                },
                {
                    "code": "MATH 125",
                    "name": "Calculus II",
                    "description": "Second quarter in the calculus of functions of a single variable. Emphasizes integral calculus. Emphasizes applications and problem solving using the tools of calculus.",
                },
            ],
        },
        {
            "name": "Washington State University",
            "location": "Pullman, WA",
            "courses": [
                {
                    "code": "PHYSICS 201",
                    "name": "Introductory Physics I",
                    "description": "Newtonian mechanics, kinematics, dynamics, work and energy, momentum, rotational motion, oscillations",
                },
                {
                    "code": "PHYSICS 202",
                    "name": "Introductory Physics II",
                    "description": "Electricity, magnetism, electric potential, capacitance, current, resistance, electromagnetic waves",
                },
                {
                    "code": "MATH 171",
                    "name": "Calculus I",
                    "description": "Functions, limits, continuity, derivatives, differentiation, applications, antiderivatives, Riemann sums",
                },
                {
                    "code": "MATH 172",
                    "name": "Calculus II",
                    "description": "Integration techniques, improper integrals, infinite series, Taylor series, parametric equations",
                },
                {
                    "code": "CPTS 121",
                    "name": "Program Design and Development",
                    "description": "Problem solving, algorithms, C programming, functions, arrays, pointers, file input output, modular design",
                },
                {
                    "code": "CPTS 223",
                    "name": "Advanced Data Structures",
                    "description": "Abstract data types, trees, graphs, hashing, sorting, algorithm analysis, complexity, C++",
                },
            ],
        },
    ]
}


def main() -> None:
    load_dotenv()

    data_path = Path(__file__).parent / "school_data.json"
    output_path = Path(__file__).parent / "match_predictions.json"
    save_schools_to_json(data_path, school_input)

    loaded = json.loads(data_path.read_text(encoding="utf-8"))
    schools = load_schools_from_dict(loaded)

    print(f"Loaded {len(schools)} schools")
    for school in schools:
        print(f"  {school.name}: {len(school.courses)} courses")

    source_school = schools[0]
    target_school = schools[1]

    model_name = os.getenv("COURSE_MATCH_MODEL", "gpt-4.1-mini")
    matcher = GPTCourseMatcher(model=model_name, temperature=0.0)
    if matcher.llm_enabled:
        print(f"\nGPT matching enabled with model: {model_name}")
    else:
        print("\nOPENAI_API_KEY not found. Using heuristic fallback for candidate ranking.")

    print("\nRecommended transfer matches:")
    results = matcher.generate_matches(source_school, target_school, shortlist_size=5, top_k=1)
    for row in results:
        print(
            f"- {row.source_course_code} {row.source_course_name} -> "
            f"{row.target_course_code} {row.target_course_name} "
            f"(confidence={row.confidence:.3f})"
        )
        print(f"  {row.rationale}")

    save_matches(output_path, results)
    print(f"\nSaved predictions for human validation: {output_path}")


if __name__ == "__main__":
    main()
