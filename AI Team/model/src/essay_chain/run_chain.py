from __future__ import annotations

import argparse
from pathlib import Path

from essay_chain.logging_config import setup_logging
from essay_chain.pipeline import PipelineConfig, default_llm_model, run_pipeline, save_outputs
from rag_vector.config import settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full essay RAG chain")
    parser.add_argument("--query", required=True, help="Student essay prompt")
    parser.add_argument("--k", type=int, default=5, help="Top-k retrieval chunks")
    parser.add_argument(
        "--user-id",
        default=settings.public_user_id,
        help="Retrieve context only from this user scope",
    )
    parser.add_argument(
        "--style",
        default="Clear, reflective, admissions-ready, concise but vivid",
        help="Style profile for style transformation stage",
    )
    parser.add_argument(
        "--emotion",
        default="Authentic motivation, resilience, curiosity, and maturity",
        help="Emotional target for emotional pass",
    )
    parser.add_argument("--model", default=default_llm_model(), help="GPT model name")
    parser.add_argument(
        "--output-dir",
        default="outputs",
        help="Directory where pipeline artifacts are written",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = PipelineConfig(
        query=args.query,
        top_k=args.k,
        user_id=args.user_id,
        style_profile=args.style,
        emotional_goal=args.emotion,
        llm_model=args.model,
        output_dir=Path(args.output_dir),
    )

    # Set up console logging
    logger = setup_logging()

    # Run pipeline and save outputs (logging to file happens in save_outputs)
    outputs = run_pipeline(config)
    run_dir = save_outputs(config, outputs)

    print("\n" + "=" * 80)
    print("Pipeline complete")
    print(f"Output folder: {run_dir}")
    print("=" * 80)
    print("\nFinal refined essay:\n")
    print(outputs.refined_essay)


if __name__ == "__main__":
    main()
