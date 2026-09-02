"""Vector storage backends.

Two backends are supported:

* ``memory`` — pure-Python in-memory store with cosine similarity
* ``chroma`` — persistent store backed by ChromaDB

Both implement the :class:`VectorStore` protocol so the tools layer is
backend-agnostic. ChromaDB is imported lazily; the server starts even
when the optional dependency is absent.
"""

from __future__ import annotations

import math
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

from .config import config
from .logger import logger


@dataclass
class SearchResult:
    document_id: str
    chunk_index: int
    text: str
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class StoredChunk:
    document_id: str
    chunk_index: int
    text: str
    embedding: list[float]
    metadata: dict[str, Any] = field(default_factory=dict)


class VectorStore(Protocol):
    """Common interface for vector stores."""

    def add(self, document_id: str, chunks: Sequence[StoredChunk]) -> None: ...
    def search(self, query_embedding: list[float], top_k: int) -> list[SearchResult]: ...
    def list_documents(self) -> list[dict[str, Any]]: ...
    def delete(self, document_id: str) -> bool: ...


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class MemoryVectorStore:
    """In-memory vector store with cosine similarity search."""

    def __init__(self) -> None:
        self._chunks: list[StoredChunk] = []
        self._doc_meta: dict[str, dict[str, Any]] = {}

    def add(self, document_id: str, chunks: Sequence[StoredChunk]) -> None:
        # Replace existing chunks for the document.
        self.delete(document_id)
        for chunk in chunks:
            self._chunks.append(chunk)
        self._doc_meta[document_id] = {
            "document_id": document_id,
            "chunk_count": len(chunks),
        }
        logger.info(
            "ingested document (memory)",
            {"document_id": document_id, "chunks": len(chunks)},
        )

    def search(self, query_embedding: list[float], top_k: int) -> list[SearchResult]:
        scored = [
            (chunk, _cosine(query_embedding, chunk.embedding)) for chunk in self._chunks
        ]
        scored.sort(key=lambda pair: pair[1], reverse=True)
        results: list[SearchResult] = []
        for chunk, score in scored[:top_k]:
            results.append(
                SearchResult(
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    score=score,
                    metadata=chunk.metadata,
                )
            )
        return results

    def list_documents(self) -> list[dict[str, Any]]:
        return list(self._doc_meta.values())

    def delete(self, document_id: str) -> bool:
        before = len(self._chunks)
        self._chunks = [c for c in self._chunks if c.document_id != document_id]
        self._doc_meta.pop(document_id, None)
        removed = before - len(self._chunks)
        if removed:
            logger.info("deleted document (memory)", {"document_id": document_id})
        return removed > 0


class ChromaVectorStore:
    """Persistent vector store backed by ChromaDB."""

    def __init__(self, persist_dir: str) -> None:
        try:
            import chromadb
        except ImportError as err:  # pragma: no cover - optional dep
            raise RuntimeError(
                "chromadb is not installed. Install it with: pip install chromadb"
            ) from err
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._collection = self._client.get_or_create_collection("rag_knowledge")
        logger.info("initialized chroma store", {"dir": persist_dir})

    def add(self, document_id: str, chunks: Sequence[StoredChunk]) -> None:
        self.delete(document_id)
        if not chunks:
            return
        ids = [f"{document_id}::{c.chunk_index}" for c in chunks]
        embeddings = [c.embedding for c in chunks]
        documents = [c.text for c in chunks]
        metadatas = [
            {"document_id": document_id, "chunk_index": c.chunk_index, **c.metadata}
            for c in chunks
        ]
        self._collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
        logger.info("ingested document (chroma)", {"document_id": document_id, "chunks": len(chunks)})

    def search(self, query_embedding: list[float], top_k: int) -> list[SearchResult]:
        result = self._collection.query(query_embeddings=[query_embedding], n_results=top_k)
        out: list[SearchResult] = []
        ids = (result.get("ids") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        for i, doc in enumerate(documents):
            meta = metadatas[i] if i < len(metadatas) else {}
            dist = distances[i] if i < len(distances) else 0.0
            # Chroma returns cosine *distance*; convert to similarity score.
            score = 1.0 - float(dist)
            out.append(
                SearchResult(
                    document_id=str(meta.get("document_id", "")),
                    chunk_index=int(meta.get("chunk_index", 0)),
                    text=doc,
                    score=score,
                    metadata={k: v for k, v in meta.items() if k not in ("document_id", "chunk_index")},
                )
            )
        return out

    def list_documents(self) -> list[dict[str, Any]]:
        all_meta = self._collection.get(include=["metadatas"])
        seen: dict[str, dict[str, Any]] = {}
        metas = all_meta.get("metadatas", []) or []
        for meta in metas:
            doc_id = str(meta.get("document_id", ""))
            if not doc_id:
                continue
            seen[doc_id] = {"document_id": doc_id, "chunk_count": seen.get(doc_id, {}).get("chunk_count", 0) + 1}
        return list(seen.values())

    def delete(self, document_id: str) -> bool:
        try:
            existing = self._collection.get(where={"document_id": document_id})
            ids = existing.get("ids", []) or []
            if not ids:
                return False
            self._collection.delete(ids=ids)
            logger.info("deleted document (chroma)", {"document_id": document_id})
            return True
        except Exception:  # noqa: BLE001
            return False


def get_vector_store() -> VectorStore:
    """Build the configured vector store instance."""
    store = config.vector_store.lower()
    logger.info("initializing vector store", {"store": store})
    if store == "chroma":
        return ChromaVectorStore(config.chroma_persist_dir)
    if store == "memory":
        return MemoryVectorStore()
    raise RuntimeError(f"unknown vector store: {store}")


def new_document_id() -> str:
    """Generate a unique document id."""
    return uuid.uuid4().hex
