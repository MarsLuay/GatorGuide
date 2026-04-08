from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).parent
PREDICTIONS_PATH = ROOT / "match_predictions.json"
FEEDBACK_PATH = ROOT / "human_feedback.jsonl"
TRAIN_JSONL_PATH = ROOT / "finetune_train.jsonl"


def _load_predictions() -> List[Dict]:
    if not PREDICTIONS_PATH.exists():
        raise FileNotFoundError("match_predictions.json not found. Run demo.py first.")
    payload = json.loads(PREDICTIONS_PATH.read_text(encoding="utf-8"))
    return [row for row in payload if isinstance(row, dict)]


def _load_feedback() -> List[Dict]:
    if not FEEDBACK_PATH.exists():
        raise FileNotFoundError("human_feedback.jsonl not found. Run validation_app.py and save feedback first.")

    rows: List[Dict] = []
    for line in FEEDBACK_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        parsed = json.loads(line)
        if isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def _feedback_key(row: Dict) -> str:
    return f"{row.get('source_school','')}::{row.get('source_course_code','')}"


def _build_training_example(source_row: Dict, selected_code: str, selected_name: str) -> Dict:
    user_prompt = (
        "Match this source course to the destination university course.\n"
        f"Source school: {source_row.get('source_school','')}\n"
        f"Source course code: {source_row.get('source_course_code','')}\n"
        f"Source course name: {source_row.get('source_course_name','')}\n"
        "Return JSON with target_code, target_name, and a brief rationale."
    )

    assistant_payload = {
        "target_code": selected_code,
        "target_name": selected_name,
        "rationale": "Aligned using human-validated transfer equivalency.",
    }

    return {
        "messages": [
            {
                "role": "system",
                "content": "You are a transfer-credit equivalency assistant for university course matching.",
            },
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": json.dumps(assistant_payload)},
        ]
    }


def main() -> None:
    predictions = _load_predictions()
    feedback_rows = _load_feedback()

    prediction_map = {_feedback_key(row): row for row in predictions}
    examples: List[Dict] = []

    for fb in feedback_rows:
        decision = str(fb.get("decision", "")).strip().lower()
        key = _feedback_key(fb)
        source_row = prediction_map.get(key)
        if source_row is None:
            continue

        if decision == "approve":
            selected_code = str(fb.get("predicted_target_code", "")).strip()
            selected_name = str(fb.get("predicted_target_name", "")).strip()
        elif decision == "edit":
            selected_code = str(fb.get("corrected_target_code", "")).strip()
            selected_name = str(fb.get("corrected_target_name", "")).strip() or "Corrected Course"
        else:
            continue

        if not selected_code:
            continue
        examples.append(_build_training_example(source_row, selected_code, selected_name))

    with TRAIN_JSONL_PATH.open("w", encoding="utf-8") as f:
        for row in examples:
            f.write(json.dumps(row) + "\n")

    print(f"Wrote {len(examples)} fine-tuning examples to {TRAIN_JSONL_PATH.name}")


if __name__ == "__main__":
    main()
