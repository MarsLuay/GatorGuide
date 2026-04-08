from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("RAG_DATA_DIR", "data/raw"))
    db_dir: Path = Path(os.getenv("RAG_DB_DIR", "data/vector_db"))
    db_backend: str = os.getenv("RAG_DB_BACKEND", "chroma")

    collection_name: str = os.getenv("RAG_COLLECTION", "essay_knowledge")
    pg_table: str = os.getenv("RAG_PG_TABLE", "rag_chunks")
    pg_sslmode: str = os.getenv("RAG_PG_SSLMODE", "require")

    # Preferred: use Supabase connection string directly.
    pg_dsn: str = os.getenv("SUPABASE_DB_URL", "")
    # Fallback: build DSN from parts when URL is not provided.
    pg_host: str = os.getenv("SUPABASE_DB_HOST", "")
    pg_port: int = int(os.getenv("SUPABASE_DB_PORT", "5432"))
    pg_name: str = os.getenv("SUPABASE_DB_NAME", "postgres")
    pg_user: str = os.getenv("SUPABASE_DB_USER", "")
    pg_password: str = os.getenv("SUPABASE_DB_PASSWORD", "")

    public_user_id: str = os.getenv("RAG_PUBLIC_USER_ID", "public")

    embed_provider: str = os.getenv("RAG_EMBED_PROVIDER", "sentence_transformers")
    embed_model: str = os.getenv("RAG_EMBED_MODEL", "all-MiniLM-L6-v2")

    chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", "800"))
    chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", "120"))


settings = Settings()
