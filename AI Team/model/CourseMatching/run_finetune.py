from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import BadRequestError, OpenAI


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Start OpenAI fine-tuning job for course matching.")
    parser.add_argument("--train-file", default="finetune_train.jsonl", help="Path to training JSONL file")
    parser.add_argument(
        "--base-model",
        default="gpt-4o-mini-2024-07-18",
        help="Base model to fine-tune (must be enabled for fine-tuning on your account)",
    )
    parser.add_argument("--suffix", default="course-matching", help="Fine-tune suffix")
    args = parser.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your shell environment or .env in CourseMatching."
        )

    train_path = Path(args.train_file)
    if not train_path.exists():
        raise FileNotFoundError(f"Training file not found: {train_path}")

    client = OpenAI(api_key=api_key)

    upload = client.files.create(file=train_path.open("rb"), purpose="fine-tune")
    print(f"Uploaded training file: {upload.id}")

    try:
        job = client.fine_tuning.jobs.create(
            training_file=upload.id,
            model=args.base_model,
            suffix=args.suffix,
        )
    except BadRequestError as exc:
        message = str(exc)
        if "model_not_available" in message or "not available for fine-tuning" in message:
            raise RuntimeError(
                "The selected base model is not available for fine-tuning on this account. "
                "Try --base-model gpt-4o-mini-2024-07-18 (or another model enabled in your OpenAI org)."
            ) from exc
        raise

    print(f"Started fine-tuning job: {job.id}")
    print("Use the OpenAI dashboard or API to monitor job status.")


if __name__ == "__main__":
    main()
