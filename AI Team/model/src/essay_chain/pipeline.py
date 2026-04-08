from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from essay_chain.llm import GPTClient
from essay_chain.logging_config import get_logger
from essay_chain.stages import (
    ChainOutputs,
    critique_pass,
    emotional_pass,
    generate_outline,
    refine_pass,
    style_transform,
)
from rag_vector.config import settings
from rag_vector.embeddings import build_embedder
from rag_vector.vectordb import build_vector_store

logger = get_logger("pipeline")


@dataclass(frozen=True)
class PipelineConfig:
    query: str
    top_k: int
    user_id: str
    style_profile: str
    emotional_goal: str
    llm_model: str
    output_dir: Path


def _format_retrieved_context(query: str, top_k: int, user_id: str) -> str:
    logger.info(f"Retrieving context for query: {query[:60]}...")
    logger.debug(f"Requesting top-{top_k} chunks")
    
    embedder = build_embedder(settings.embed_provider, settings.embed_model)
    logger.debug(f"Embedder initialized: {settings.embed_provider} ({settings.embed_model})")
    
    store = build_vector_store(settings)
    logger.debug(f"Vector store connected: {settings.db_dir} / collection={settings.collection_name}")

    logger.debug("Embedding query...")
    query_embedding = embedder.embed_query(query)
    logger.debug(f"Query embedding shape: {len(query_embedding)}")
    
    logger.debug("Executing similarity search...")
    rows = store.query_for_user(query_embedding=query_embedding, k=top_k, user_id=user_id)
    logger.info(f"Retrieved {len(rows)} chunks from vector database")

    if not rows:
        logger.warning("No retrieval results found")
        return ""

    sections: list[str] = []
    for idx, row in enumerate(rows, start=1):
        logger.debug(f"  [{idx}] {row.source} (chunk {row.index}, distance {row.score:.4f})")
        sections.append(
            "[Reference "
            f"{idx}] user_id={row.user_id} source={row.source} type={row.source_type} "
            f"chunk={row.index} distance={row.score:.4f}\n{row.text}"
        )
    
    context = "\n\n".join(sections)
    logger.info(f"Formatted context total length: {len(context)} characters")
    return context


def run_pipeline(config: PipelineConfig) -> ChainOutputs:
    logger.info("=" * 80)
    logger.info("Starting Essay Generation Chain")
    logger.info("=" * 80)
    logger.info(f"Query: {config.query}")
    logger.info(f"Config: top_k={config.top_k}, model={config.llm_model}")
    logger.info(f"User scope: user_id={config.user_id}")
    logger.info(f"Style: {config.style_profile[:60]}...")
    logger.info(f"Emotion goal: {config.emotional_goal[:60]}...")
    
    logger.info("\n[STEP 1/6] Retrieving essays...")
    retrieved_context = _format_retrieved_context(
        query=config.query,
        top_k=config.top_k,
        user_id=config.user_id,
    )
    if not retrieved_context:
        logger.error("No retrieval results found. Ingest documents first.")
        raise ValueError(
            "No retrieval results found. Run ingestion first: python -m rag_vector.ingest"
        )

    logger.info("\n[STEP 2/6] Generating outline...")
    llm = GPTClient(model=config.llm_model)
    outline = generate_outline(llm=llm, user_prompt=config.query, context=retrieved_context)
    
    logger.info("\n[STEP 3/6] Applying style transformation...")
    styled_draft = style_transform(
        llm=llm,
        user_prompt=config.query,
        outline=outline,
        style=config.style_profile,
    )
    
    logger.info("\n[STEP 4/6] Applying emotional pass...")
    emotional_draft = emotional_pass(
        llm=llm,
        styled_draft=styled_draft,
        emotional_goal=config.emotional_goal,
    )
    
    logger.info("\n[STEP 5/6] Running critique...")
    critique = critique_pass(llm=llm, user_prompt=config.query, emotional_draft=emotional_draft)
    
    logger.info("\n[STEP 6/6] Refining essay...")
    refined_essay = refine_pass(llm=llm, emotional_draft=emotional_draft, critique=critique)
    
    logger.info("\n" + "=" * 80)
    logger.info("Essay Generation Chain Complete")
    logger.info("=" * 80)

    return ChainOutputs(
        retrieved_context=retrieved_context,
        outline=outline,
        styled_draft=styled_draft,
        emotional_draft=emotional_draft,
        critique=critique,
        refined_essay=refined_essay,
    )


def save_outputs(config: PipelineConfig, outputs: ChainOutputs, log_file: Path | None = None) -> Path:
    logger.info("Saving pipeline outputs...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = config.output_dir / f"run_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=True)
    logger.debug(f"Output directory created: {run_dir}")

    payload = {
        "config": {
            "query": config.query,
            "top_k": config.top_k,
            "user_id": config.user_id,
            "style_profile": config.style_profile,
            "emotional_goal": config.emotional_goal,
            "llm_model": config.llm_model,
            "embed_provider": settings.embed_provider,
            "embed_model": settings.embed_model,
            "vector_db": str(settings.db_dir),
            "collection": settings.collection_name,
        },
        "outputs": asdict(outputs),
    }

    json_path = run_dir / "pipeline_output.json"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Saved JSON output: {json_path}")

    markdown_path = run_dir / "pipeline_output.md"
    markdown_path.write_text(
        "\n\n".join(
            [
                "# Essay Chain Output",
                "## Query\n" + config.query,
                "## Retrieved Context\n" + outputs.retrieved_context,
                "## Generated Outline\n" + outputs.outline,
                "## Style Transform Draft\n" + outputs.styled_draft,
                "## Emotional Pass Draft\n" + outputs.emotional_draft,
                "## Critique\n" + outputs.critique,
                "## Refined Essay\n" + outputs.refined_essay,
            ]
        ),
        encoding="utf-8",
    )
    logger.info(f"Saved Markdown output: {markdown_path}")
    
    # Add file logging for this run directory
    file_log_path = run_dir / "pipeline.log"
    file_handler = logging.FileHandler(file_log_path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_formatter)
    logging.getLogger("essay_chain").addHandler(file_handler)
    logger.info(f"Saved logs to: {file_log_path}")
    
    return run_dir


def default_llm_model() -> str:
    return os.getenv("RAG_LLM_MODEL", "gpt-4o-mini")
