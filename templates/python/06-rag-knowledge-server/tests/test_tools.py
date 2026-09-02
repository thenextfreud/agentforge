"""Unit tests for the RAG knowledge server tools and utilities.

These tests exercise the pure-Python pieces (chunker, memory vector store,
error helpers) so they run without optional dependencies like
sentence-transformers or chromadb.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the template root is importable when running pytest from the
# template directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.lib.chunker import Chunker  # noqa: E402
from src.lib.errors import ToolError, failure, success  # noqa: E402
from src.lib.vectorstore import MemoryVectorStore, StoredChunk  # noqa: E402


def test_chunker_splits_long_text():
    chunker = Chunker(chunk_size=50, chunk_overlap=10)
    text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five."
    chunks = chunker.chunk(text)
    assert len(chunks) >= 2
    assert all(c.text for c in chunks)
    assert chunks[0].index == 0
    assert chunks[1].index == 1


def test_chunker_empty_text_returns_no_chunks():
    chunker = Chunker(chunk_size=100, chunk_overlap=10)
    assert chunker.chunk("") == []
    assert chunker.chunk("   \n\n  ") == []


def test_chunker_rejects_bad_config():
    import pytest

    with pytest.raises(ValueError):
        Chunker(chunk_size=0, chunk_overlap=0)
    with pytest.raises(ValueError):
        Chunker(chunk_size=10, chunk_overlap=10)


def test_memory_vector_store_add_search_delete():
    store = MemoryVectorStore()
    chunks = [
        StoredChunk(document_id="doc1", chunk_index=0, text="hello world", embedding=[1.0, 0.0]),
        StoredChunk(document_id="doc1", chunk_index=1, text="foo bar", embedding=[0.0, 1.0]),
    ]
    store.add("doc1", chunks)

    docs = store.list_documents()
    assert len(docs) == 1
    assert docs[0]["document_id"] == "doc1"

    results = store.search([1.0, 0.0], top_k=1)
    assert len(results) == 1
    assert results[0].document_id == "doc1"
    assert results[0].text == "hello world"
    assert results[0].score > 0.99

    assert store.delete("doc1") is True
    assert store.list_documents() == []
    assert store.delete("doc1") is False


def test_success_and_failure_helpers():
    ok = success("hello")
    assert ok[0].text == "hello"

    err = failure("CODE", "bad thing")
    assert "CODE" in err[0].text
    assert "bad thing" in err[0].text


def test_tool_error_message_format():
    err = ToolError("NOT_FOUND", "missing doc")
    assert "NOT_FOUND" in str(err)
    assert "missing doc" in str(err)
    assert err.code == "NOT_FOUND"
