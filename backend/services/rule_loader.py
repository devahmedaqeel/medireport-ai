import json
from functools import lru_cache
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RULES = BASE / "rules"
KB = BASE / "knowledge_base"

@lru_cache(maxsize=32)
def load_json_rule(rule_name: str):
    safe = rule_name.replace("..", "").replace("/", "")
    if not safe.endswith(".json"):
        safe += ".json"
    for folder in (RULES, KB):
        path = folder / safe
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return {"error": f"Rule file {safe} not found"}
