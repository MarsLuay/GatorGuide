from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Iterable

from openai import OpenAI
from sentence_transformers import SentenceTransformer


class Embedder(ABC):
    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        raise NotImplementedError


class SentenceTransformersEmbedder(Embedder):
    def __init__(self, model_name: str) -> None:
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return vectors.tolist()

    def embed_query(self, text: str) -> list[float]:
        vector = self.model.encode([text], convert_to_numpy=True, show_progress_bar=False)[0]
        return vector.tolist()


class OpenAIEmbedder(Embedder):
    def __init__(self, model_name: str) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required when RAG_EMBED_PROVIDER=openai")

        self.client = OpenAI(api_key=api_key)
        self.model_name = model_name

    def _embed(self, texts: Iterable[str]) -> list[list[float]]:
        response = self.client.embeddings.create(model=self.model_name, input=list(texts))
        return [item.embedding for item in response.data]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text])[0]


def build_embedder(provider: str, model_name: str) -> Embedder:
    provider_name = provider.strip().lower()
    if provider_name == "sentence_transformers":
        return SentenceTransformersEmbedder(model_name=model_name)
    if provider_name == "openai":
        return OpenAIEmbedder(model_name=model_name)

    raise ValueError(f"Unsupported embed provider: {provider}")
