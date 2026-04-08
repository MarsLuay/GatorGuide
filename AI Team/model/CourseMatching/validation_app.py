from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import streamlit as st


ROOT = Path(__file__).parent
PREDICTIONS_PATH = ROOT / "match_predictions.json"
FEEDBACK_PATH = ROOT / "human_feedback.jsonl"


def _load_predictions() -> List[Dict]:
    if not PREDICTIONS_PATH.exists():
        return []
    data = json.loads(PREDICTIONS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def _append_feedback(record: Dict) -> None:
    with FEEDBACK_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def _feedback_count() -> int:
    if not FEEDBACK_PATH.exists():
        return 0
    return sum(1 for _ in FEEDBACK_PATH.open("r", encoding="utf-8"))


def main() -> None:
    st.set_page_config(page_title="Course Match Validation", layout="wide")
    st.title("Course Matching Validation")
    st.caption("Review GPT suggestions and approve/reject for fine-tuning data.")

    predictions = _load_predictions()
    if not predictions:
        st.warning("No predictions found. Run demo.py first to generate match_predictions.json.")
        return

    st.write(f"Loaded {len(predictions)} predicted matches.")
    st.write(f"Existing feedback rows: {_feedback_count()}")

    idx = st.number_input("Match index", min_value=0, max_value=len(predictions) - 1, value=0, step=1)
    row = predictions[int(idx)]

    left, right = st.columns(2)
    with left:
        st.subheader("Source course")
        st.write(f"School: {row.get('source_school', '')}")
        st.write(f"Code: {row.get('source_course_code', '')}")
        st.write(f"Name: {row.get('source_course_name', '')}")

    with right:
        st.subheader("Predicted target")
        st.write(f"School: {row.get('target_school', '')}")
        st.write(f"Code: {row.get('target_course_code', '')}")
        st.write(f"Name: {row.get('target_course_name', '')}")
        st.write(f"Confidence: {row.get('confidence', 0.0)}")

    st.markdown("**Model rationale**")
    st.write(row.get("rationale", ""))

    decision = st.radio("Decision", ["approve", "reject", "edit"], horizontal=True)
    corrected_code = st.text_input("Corrected target code (required for edit)", value="")
    corrected_name = st.text_input("Corrected target name (optional)", value="")
    notes = st.text_area("Reviewer notes", value="")
    reviewer = st.text_input("Reviewer", value="advisor_1")

    if st.button("Save feedback", type="primary"):
        if decision == "edit" and not corrected_code.strip():
            st.error("Corrected target code is required for edit decision.")
            return

        feedback = {
            "source_school": row.get("source_school"),
            "source_course_code": row.get("source_course_code"),
            "source_course_name": row.get("source_course_name"),
            "predicted_target_code": row.get("target_course_code"),
            "predicted_target_name": row.get("target_course_name"),
            "decision": decision,
            "corrected_target_code": corrected_code.strip() or None,
            "corrected_target_name": corrected_name.strip() or None,
            "confidence": row.get("confidence"),
            "rationale": row.get("rationale"),
            "notes": notes.strip(),
            "reviewer": reviewer.strip(),
        }
        _append_feedback(feedback)
        st.success("Feedback saved to human_feedback.jsonl")


if __name__ == "__main__":
    main()
