from typing import Optional

_active_tokens: dict[str, dict] = {}


def get_active_tokens() -> dict[str, dict]:
    return _active_tokens


def set_active_tokens(tokens: dict[str, dict]) -> None:
    _active_tokens.clear()
    _active_tokens.update(tokens)
