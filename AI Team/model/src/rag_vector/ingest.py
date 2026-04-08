from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from pypdf import PdfReader

from rag_vector.chunking import chunk_text
from rag_vector.config import settings
from rag_vector.embeddings import build_embedder
from rag_vector.vectordb import VectorStore, build_vector_store


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def read_pdf_file(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def load_document(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return read_text_file(path)
    if suffix == ".pdf":
        return read_pdf_file(path)
    return ""


def iter_source_files(data_dir: Path) -> list[Path]:
    if not data_dir.exists():
        return []

    patterns = ("**/*.txt", "**/*.md", "**/*.pdf")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(data_dir.glob(pattern))
    return sorted(set(files))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest documents or direct user text into vector DB")
    parser.add_argument(
        "--user-id",
        default=settings.public_user_id,
        help="Owner of ingested content. Use a real user id for personal notes.",
    )
    parser.add_argument("--user-text", help="Raw user text to ingest directly", default=None)
    parser.add_argument(
        "--user-text-file",
        help="Path to a text/markdown/pdf file to ingest for a specific user",
        default=None,
    )
    parser.add_argument(
        "--source",
        default="user_input",
        help="Source label used when ingesting --user-text",
    )
    return parser.parse_args()


def make_chunk_id(user_id: str, source: str, index: int) -> str:
    payload = f"{user_id}::{source}::{index}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return f"{user_id}::{source}::chunk::{index}::{digest}"


def ingest_content(
    *,
    content: str,
    source_name: str,
    source_type: str,
    user_id: str,
    store: VectorStore,
    embedder: object,
) -> int:
    chunks = list(
        chunk_text(
            text=content,
            source=source_name,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
    )

    if not chunks:
        return 0

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, object]] = []

    for chunk in chunks:
        ids.append(make_chunk_id(user_id=user_id, source=chunk.source, index=chunk.index))
        documents.append(chunk.text)
        metadatas.append(
            {
                "source": chunk.source,
                "index": chunk.index,
                "user_id": user_id,
                "source_type": source_type,
            }
        )

    embeddings = embedder.embed_documents(documents)
    store.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    return len(documents)


def main() -> None:
    args = parse_args()

    embedder = build_embedder(settings.embed_provider, settings.embed_model)
    store = build_vector_store(settings)

    if args.user_text and args.user_text_file:
        raise ValueError("Use either --user-text or --user-text-file, not both.")

    # User direct input mode: store per-user memory (notes/profile/context).
    if args.user_text:
        ingested = ingest_content(
            content=args.user_text,
            source_name=args.source,
            source_type="user_input",
            user_id=args.user_id,
            store=store,
            embedder=embedder,
        )
        print(
            f"Ingestion completed: user_id='{args.user_id}', source='{args.source}', chunks={ingested}, "
            f"collection='{settings.collection_name}'"
        )
        return

    if args.user_text_file:
        user_file = Path(args.user_text_file)
        if not user_file.exists():
            raise FileNotFoundError(f"File not found: {user_file}")

        content = load_document(user_file)
        if not content.strip():
            raise ValueError(f"No readable content found in file: {user_file}")

        source_type = "pdf" if user_file.suffix.lower() == ".pdf" else "text"
        ingested = ingest_content(
            content=content,
            source_name=user_file.name,
            source_type=source_type,
            user_id=args.user_id,
            store=store,
            embedder=embedder,
        )
        print(
            f"Ingestion completed: user_id='{args.user_id}', source_file='{user_file}', chunks={ingested}, "
            f"collection='{settings.collection_name}'"
        )
        return

    source_files = iter_source_files(settings.data_dir)
    if not source_files:
        print(f"No source files found in: {settings.data_dir}")
        return

    total_chunks = 0

    for file_path in source_files:
        content = load_document(file_path)
        source_name = str(file_path.relative_to(settings.data_dir))
        source_type = "pdf" if file_path.suffix.lower() == ".pdf" else "text"

        total_chunks += ingest_content(
            content=content,
            source_name=source_name,
            source_type=source_type,
            user_id=settings.public_user_id,
            store=store,
            embedder=embedder,
        )

    if total_chunks == 0:
        print("No chunks generated from available files.")
        return

    print(
        f"Ingestion completed: {len(source_files)} files, {total_chunks} chunks, user_id='{settings.public_user_id}', "
        f"collection='{settings.collection_name}'"
    )


if __name__ == "__main__":
    main()
