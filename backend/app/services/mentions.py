import re

_FENCED_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)
_UNCLOSED_FENCE_RE = re.compile(r"```.*", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
_MENTION_RE = re.compile(r"(?<![A-Za-z0-9_.\-@])@([A-Za-z0-9_-]{3,30})(?![A-Za-z0-9_-])")

def extract_mentions(body: str) -> set[str]:
    text = _FENCED_BLOCK_RE.sub(" ", body)
    text = _UNCLOSED_FENCE_RE.sub(" ", text)
    text = _INLINE_CODE_RE.sub(" ", text)
    return {m.group(1) for m in _MENTION_RE.finditer(text)}
