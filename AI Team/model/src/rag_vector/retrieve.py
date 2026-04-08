from __future__ import annotations

import argparse

from rag_vector.config import settings
from rag_vector.embeddings import build_embedder
from rag_vector.vectordb import build_vector_store


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Retrieve relevant essay chunks from vector DB")
    parser.add_argument("--query", required=True, help="User query")
    parser.add_argument("--k", type=int, default=5, help="Top-k results")
    parser.add_argument(
        "--user-id",
        default=settings.public_user_id,
        help="Filter retrieval to this user id",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    embedder = build_embedder(settings.embed_provider, settings.embed_model)
    store = build_vector_store(settings)

    query_embedding = embedder.embed_query(args.query)
    rows = store.query_for_user(query_embedding=query_embedding, k=args.k, user_id=args.user_id)

    if not rows:
        print(f"No results found for user_id='{args.user_id}'. Did you run ingestion first?")
        return

    print(f"Top {len(rows)} results for user_id='{args.user_id}' and query: {args.query}\n")
    for idx, row in enumerate(rows, start=1):
        print(
            f"[{idx}] user_id={row.user_id} source={row.source} "
            f"type={row.source_type} chunk={row.index} distance={row.score:.4f}"
        )
        print(row.text)
        print("-" * 80)


if __name__ == "__main__":
    main()
