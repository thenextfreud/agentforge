"""Pluggable embedding generation.

Two providers are supported:

* ``local``  — uses ``sentence-transformers`` (downloaded on first use)
* ``openai`` — uses the OpenAI embeddings API

Both implement the same :class:`Embedder` protocol so the vector store
and tools never need to know which is active. Providers are imported
lazily so the server starts even when optional dependencies are missing
(the relevant provider simply raises a clear error on first use).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol

from .config import config
from .logger import logger


class Embedder(Protocol):
    """Common interface for embedding providers."""

    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...
    @property
    def dimensions(self) -> int: ...


class LocalEmbedder:
    """Embedding provider backed by ``sentence-transformers``."""

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model: Any | None = None

    def _load(self) -> Any:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as err:  # pragma: no cover - optional dep
                raise RuntimeError(
                    "sentence-transformers is not installed. "
                    "Install it with: pip install sentence-transformers"
                ) from err
            logger.info("loading local embedding model", {"model": self._model_name})
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        model = self._load()
        vectors = model.encode(list(texts), convert_to_numpy=True)
        return [list(map(float, vec)) for vec in vectors]

    @property
    def dimensions(self) -> int:
        # MiniLM is 384-dim; load to be exact if unsure.
        try:
            return int(self._load().get_sentence_embedding_dimension())
        except Exception:  # noqa: BLE001
            return 384


class OpenAIEmbedder:
    """Embedding provider backed by the OpenAI API."""

    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for the openai embedding provider")
        self._api_key = api_key
        self._model = model
        self._client: Any | None = None

    def _load(self) -> Any:
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as err:  # pragma: no cover - optional dep
                raise RuntimeError(
                    "openai is not installed. Install it with: pip install openai"
                ) from err
            self._client = OpenAI(api_key=self._api_key)
        return self._client

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        client = self._load()
        response = client.embeddings.create(input=list(texts), model=self._model)
        return [list(map(float, item.embedding)) for item in response.data]

    @property
    def dimensions(self) -> int:
        return 1536  # text-embedding-3-small


def get_embedder() -> Embedder:
    """Build the configured embedder instance."""
    provider = config.embedding_provider.lower()
    logger.info("initializing embedding provider", {"provider": provider})
    if provider == "openai":
        return OpenAIEmbedder(config.openai_api_key, config.openai_embedding_model)
    if provider == "local":
        return LocalEmbedder(config.local_embedding_model)
    raise RuntimeError(f"unknown embedding provider: {provider}")
