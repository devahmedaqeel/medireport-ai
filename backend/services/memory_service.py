import json
import os
from pathlib import Path
from datetime import datetime

MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"
MEMORY_DIR.mkdir(exist_ok=True)

FILES = {
    "alias": MEMORY_DIR / "alias_memory.json",
    "ocr": MEMORY_DIR / "ocr_correction_memory.json",
    "layout": MEMORY_DIR / "layout_memory.json",
    "range": MEMORY_DIR / "reference_range_memory.json",
    "rule": MEMORY_DIR / "verified_rule_memory.json",
    "pending": MEMORY_DIR / "pending_feedback_memory.json",
    "rejected": MEMORY_DIR / "rejected_feedback_memory.json",
    "accuracy": MEMORY_DIR / "accuracy_history_memory.json"
}

def _load(file_key):
    path = FILES.get(file_key)
    if not path or not path.exists():
        return {} if "memory" in file_key else []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except:
        return {} if "memory" in file_key else []

def _save(file_key, data):
    path = FILES.get(file_key)
    if path:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def get_verified_aliases():
    return _load("alias")

def get_ocr_corrections():
    return _load("ocr")

def add_pending_correction(user_id, report_id, original, corrected, correction_type):
    """
    Adds a user-submitted correction to the pending queue.
    """
    pending = _load("pending")
    pending.append({
        "feedbackId": os.urandom(8).hex(),
        "userId": user_id,
        "reportId": report_id,
        "original": original,
        "corrected": corrected,
        "type": correction_type,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "pending"
    })
    _save("pending", pending)

def save_accuracy_snapshot(metrics):
    """Saves an evaluation result to history memory."""
    history = _load("accuracy")
    if not isinstance(history, list): history = []
    history.append({
        "metrics": metrics,
        "timestamp": datetime.utcnow().isoformat()
    })
    _save("accuracy", history)

def get_memory_status():
    """Returns a summary of all memory tiers."""
    return {
        "aliases": len(get_verified_aliases()),
        "ocr_corrections": len(get_ocr_corrections()),
        "pending_corrections": len(_load("pending")),
        "accuracy_history": len(_load("accuracy"))
    }

def approve_correction(feedback_id):
    """
    Approves a user-submitted correction and moves it to active memory.
    """
    pending = _load("pending")
    match = None
    remaining = []
    for p in pending:
        if p.get("feedbackId") == feedback_id:
            match = p
        else:
            remaining.append(p)
            
    if not match:
        return False
        
    _save("pending", remaining)
    
    m_type = match.get("type", "ocr")
    memory_data = _load(m_type)
    if not isinstance(memory_data, dict):
        memory_data = {}
        
    original = match.get("original")
    corrected = match.get("corrected")
    
    if m_type == "alias":
        # map corrected (alias) -> original (standard)
        memory_data[str(corrected).lower()] = str(original)
    else:
        # map original (wrong text) -> corrected (right text)
        memory_data[str(original)] = str(corrected)
        
    _save(m_type, memory_data)
    return True
