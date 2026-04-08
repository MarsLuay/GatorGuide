from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import chromadb
import psycopg
from psycopg.types.json import Json

from rag_vector.config import Settings


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    text: str
    source: str
    index: int
    user_id: str
    source_type: str
    score: float


class VectorStore(Protocol):
    def upsert(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        ...

    def query(self, query_embedding: list[float], k: int) -> list[RetrievedChunk]:
        ...

    def query_for_user(self, query_embedding: list[float], k: int, user_id: str) -> list[RetrievedChunk]:
        ...


class ChromaVectorStore:
    def __init__(self, db_dir: Path, collection_name: str) -> None:
        db_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(db_dir))
        self.collection = self.client.get_or_create_collection(name=collection_name)

    def upsert(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    def query(self, query_embedding: list[float], k: int) -> list[RetrievedChunk]:
        return self._query(query_embedding=query_embedding, k=k, where=None)

    def query_for_user(self, query_embedding: list[float], k: int, user_id: str) -> list[RetrievedChunk]:
        return self._query(query_embedding=query_embedding, k=k, where={"user_id": user_id})

    def _query(
        self,
        query_embedding: list[float],
        k: int,
        where: dict[str, Any] | None,
    ) -> list[RetrievedChunk]:
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            include=["documents", "metadatas", "distances"],
            where=where,
        )

        ids = result.get("ids", [[]])[0]
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        rows: list[RetrievedChunk] = []
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances):
            metadata = metadata or {}
            rows.append(
                RetrievedChunk(
                    id=chunk_id,
                    text=text,
                    source=metadata.get("source", "unknown"),
                    index=int(metadata.get("index", -1)),
                    user_id=str(metadata.get("user_id", "unknown")),
                    source_type=str(metadata.get("source_type", "unknown")),
                    score=float(distance),
                )
            )
        return rows


class PostgresVectorStore:
    def __init__(self, dsn: str, table_name: str, collection_name: str, sslmode: str = "require") -> None:
        self.table_name = table_name
        self.collection_name = collection_name
        self.conn = psycopg.connect(self._normalize_dsn(dsn=dsn, sslmode=sslmode), autocommit=True)
        self.embedding_column_type = self._get_embedding_column_type()

    @staticmethod
    def _normalize_dsn(dsn: str, sslmode: str) -> str:
        # Auto-encode user/password to avoid connection failures when credentials
        # contain spaces or reserved URL characters.
        dsn = PostgresVectorStore._sanitize_dsn_credentials(dsn)

        if "sslmode=" in dsn:
            return dsn
        sep = "&" if "?" in dsn else "?"
        return f"{dsn}{sep}sslmode={sslmode}"

    @staticmethod
    def _sanitize_dsn_credentials(dsn: str) -> str:
        if not dsn.startswith(("postgresql://", "postgres://")):
            return dsn

        parts = urlsplit(dsn)
        username = parts.username
        password = parts.password

        if username is None and password is None:
            return dsn

        userinfo = ""
        if username is not None:
            userinfo += quote(unquote(username), safe="")
        if password is not None:
            userinfo += f":{quote(unquote(password), safe='')}"
        userinfo += "@"

        host = parts.hostname or ""
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"

        netloc = userinfo + host
        if parts.port is not None:
            netloc += f":{parts.port}"

        return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))

    @staticmethod
    def _embedding_to_vector_literal(embedding: list[float]) -> str:
        return "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"

    def _get_embedding_column_type(self) -> str:
        sql = """
        select udt_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = %s
          and column_name = 'embedding'
        limit 1
        """
        with self.conn.cursor() as cur:
            cur.execute(sql, (self.table_name,))
            row = cur.fetchone()

        if row is None:
            raise ValueError(
                f"Column 'embedding' not found on table '{self.table_name}'. "
                "Create the table first."
            )

        return str(row[0])

    def upsert(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        if self.embedding_column_type == "vector":
            embedding_sql = "%s::vector"
        elif self.embedding_column_type in {"_float4", "_float8"}:
            embedding_sql = "%s"
        else:
            raise ValueError(
                f"Unsupported embedding column type '{self.embedding_column_type}' on table '{self.table_name}'. "
                "Use vector or float4[]/float8[]."
            )

        sql = f"""
        insert into {self.table_name}
            (chunk_id, collection_name, user_id, source, source_type, chunk_index, chunk_text, embedding, metadata)
        values
            (%s, %s, %s, %s, %s, %s, %s, {embedding_sql}, %s)
        on conflict (chunk_id)
        do update set
            collection_name = excluded.collection_name,
            user_id = excluded.user_id,
            source = excluded.source,
            source_type = excluded.source_type,
            chunk_index = excluded.chunk_index,
            chunk_text = excluded.chunk_text,
            embedding = excluded.embedding,
            metadata = excluded.metadata,
            updated_at = now()
        """

        with self.conn.cursor() as cur:
            for chunk_id, embedding, text, metadata in zip(ids, embeddings, documents, metadatas):
                metadata = metadata or {}
                cur.execute(
                    sql,
                    (
                        chunk_id,
                        self.collection_name,
                        str(metadata.get("user_id", "unknown")),
                        str(metadata.get("source", "unknown")),
                        str(metadata.get("source_type", "unknown")),
                        int(metadata.get("index", -1)),
                        text,
                        self._embedding_to_vector_literal(embedding)
                        if self.embedding_column_type == "vector"
                        else embedding,
                        Json(metadata),
                    ),
                )

    def query(self, query_embedding: list[float], k: int) -> list[RetrievedChunk]:
        return self._query(query_embedding=query_embedding, k=k, user_id=None)

    def query_for_user(self, query_embedding: list[float], k: int, user_id: str) -> list[RetrievedChunk]:
        return self._query(query_embedding=query_embedding, k=k, user_id=user_id)

    def _query(self, query_embedding: list[float], k: int, user_id: str | None) -> list[RetrievedChunk]:
        if self.embedding_column_type != "vector":
            raise ValueError(
                "Vector similarity query requires pgvector and embedding column type vector. "
                "Current embedding type is float array. Enable pgvector and alter the column to vector(N)."
            )

        vector_literal = self._embedding_to_vector_literal(query_embedding)
        where_clause = "where collection_name = %s"
        params: list[Any] = [self.collection_name]

        if user_id is not None:
            where_clause += " and user_id = %s"
            params.append(user_id)

        sql = f"""
        select
            chunk_id,
            chunk_text,
            source,
            source_type,
            chunk_index,
            user_id,
            (embedding <=> %s::vector) as distance
        from {self.table_name}
        {where_clause}
        order by embedding <=> %s::vector
        limit %s
        """

        # Reuse query embedding for both selected distance value and ORDER BY.
        query_params = [vector_literal] + params + [vector_literal, k]

        rows: list[RetrievedChunk] = []
        with self.conn.cursor() as cur:
            cur.execute(sql, query_params)
            for rec in cur.fetchall():
                rows.append(
                    RetrievedChunk(
                        id=str(rec[0]),
                        text=str(rec[1]),
                        source=str(rec[2]),
                        source_type=str(rec[3]),
                        index=int(rec[4]),
                        user_id=str(rec[5]),
                        score=float(rec[6]),
                    )
                )
        return rows


def _build_pg_dsn(settings: Settings) -> str:
    if settings.pg_dsn.strip():
        return settings.pg_dsn.strip()

    required = [settings.pg_host, settings.pg_user, settings.pg_password]
    if not all(required):
        raise ValueError(
            "Postgres backend selected but Supabase connection settings are incomplete. "
            "Set SUPABASE_DB_URL or SUPABASE_DB_HOST/SUPABASE_DB_USER/SUPABASE_DB_PASSWORD."
        )

    return (
        "postgresql://"
        f"{settings.pg_user}:{settings.pg_password}@{settings.pg_host}:{settings.pg_port}/{settings.pg_name}"
    )


def build_vector_store(settings: Settings) -> VectorStore:
    backend = settings.db_backend.strip().lower()
    if backend == "chroma":
        return ChromaVectorStore(settings.db_dir, settings.collection_name)
    if backend == "postgres":
        return PostgresVectorStore(
            dsn=_build_pg_dsn(settings),
            table_name=settings.pg_table,
            collection_name=settings.collection_name,
            sslmode=settings.pg_sslmode,
        )

    raise ValueError(f"Unsupported RAG_DB_BACKEND: {settings.db_backend}. Use 'chroma' or 'postgres'.")
