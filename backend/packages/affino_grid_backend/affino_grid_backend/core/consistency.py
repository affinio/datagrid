from __future__ import annotations

from collections.abc import Mapping
from hashlib import sha256
import json
from typing import Any


def canonical_projection_hash(projection: Any) -> str:
    normalized = _normalize_json_value(_coerce_json_value(projection))
    return _sha256_canonical_json(normalized)


def build_boundary_token(payload: Mapping[str, Any]) -> str:
    normalized = _normalize_json_value(_coerce_json_value(dict(payload)))
    return f"v1:{_sha256_canonical_json(normalized)}"


def _coerce_json_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return _coerce_json_value(value.model_dump(by_alias=True))
    if isinstance(value, Mapping):
        return {str(key): _coerce_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_coerce_json_value(item) for item in value]
    if isinstance(value, tuple):
        return [_coerce_json_value(item) for item in value]
    if isinstance(value, set):
        return [_coerce_json_value(item) for item in sorted(value, key=repr)]
    return value


def _normalize_json_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _normalize_json_value(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [_normalize_json_value(item) for item in value]
    return value


def _sha256_canonical_json(value: Any) -> str:
    canonical_json = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(canonical_json.encode("utf-8")).hexdigest()
