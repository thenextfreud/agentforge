"""Pagination helpers for SaaS list endpoints.

Supports both common styles:

* **cursor-based** — ``{ "data": [...], "next_cursor": "abc" }`` (Stripe,
  Linear, modern APIs).
* **page-based** — ``{ "data": [...], "page": 2, "total_pages": 10 }``
  (legacy APIs).

:func:`paginate` is an async generator that yields each page's ``data``
list until there is no next page, normalizing both styles behind one
interface.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from .saas_client import SaaSClient


def _extract_items(page: dict[str, Any]) -> list[dict[str, Any]]:
    """Pull the list of items out of a page response."""
    for key in ("data", "items", "results", "records"):
        if key in page and isinstance(page[key], list):
            return page[key]
    # If the whole response is a list, treat it as one page.
    if isinstance(page, list):
        return page
    return []


def _next_cursor(page: dict[str, Any]) -> str | None:
    for key in ("next_cursor", "cursor", "next", "after"):
        val = page.get(key)
        if isinstance(val, str) and val:
            return val
    # Some APIs nest under "pagination" or "meta".
    for nested in ("pagination", "meta", "paging"):
        block = page.get(nested)
        if isinstance(block, dict):
            for key in ("next_cursor", "cursor", "next", "after"):
                val = block.get(key)
                if isinstance(val, str) and val:
                    return val
    return None


def _total_pages(page: dict[str, Any]) -> int | None:
    for key in ("total_pages", "totalPages", "pages"):
        val = page.get(key)
        if isinstance(val, int):
            return val
    for nested in ("pagination", "meta", "paging"):
        block = page.get(nested)
        if isinstance(block, dict):
            for key in ("total_pages", "totalPages", "pages"):
                val = block.get(key)
                if isinstance(val, int):
                    return val
    return None


async def paginate(
    client: SaaSClient,
    path: str,
    *,
    page_size: int = 50,
    max_pages: int = 100,
    extra_params: dict[str, Any] | None = None,
) -> AsyncIterator[list[dict[str, Any]]]:
    """Yield successive pages of items from a SaaS list endpoint.

    Detects cursor vs page-based pagination automatically. Stops when
    there are no more items, no next cursor, or ``max_pages`` is reached.
    """
    params: dict[str, Any] = dict(extra_params or {})
    cursor = None
    page_num = 1

    for _ in range(max_pages):
        if cursor:
            # Cursor APIs typically use a `cursor` or `after` query param.
            params["cursor"] = cursor
            params.pop("page", None)
        else:
            params.setdefault("page", page_num)
            params.setdefault("page_size", page_size)
            params.setdefault("per_page", page_size)

        page = await client.get(path, params=params)
        items = _extract_items(page)
        if items:
            yield items

        # Try cursor-based advancement first.
        next_cursor = _next_cursor(page)
        if next_cursor:
            cursor = next_cursor
            continue

        # Fall back to page-based advancement.
        total = _total_pages(page)
        if total is not None:
            if page_num >= total:
                break
            page_num += 1
            cursor = None
            continue

        # No cursor and no total-pages info: stop if the page was empty
        # or smaller than the requested size.
        if not items or len(items) < page_size:
            break
        page_num += 1
        cursor = None


async def collect_all(
    client: SaaSClient,
    path: str,
    *,
    page_size: int = 50,
    max_pages: int = 100,
    extra_params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Eagerly collect every item across all pages into a single list."""
    out: list[dict[str, Any]] = []
    async for items in paginate(
        client, path, page_size=page_size, max_pages=max_pages, extra_params=extra_params
    ):
        out.extend(items)
    return out
